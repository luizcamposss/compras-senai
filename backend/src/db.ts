import bcrypt from "bcryptjs";
import { createRequire } from "node:module";
import type * as SqlTypes from "mssql";

const require = createRequire(import.meta.url);
const sql = require("mssql/msnodesqlv8") as typeof SqlTypes;

type QueryExecutor = SqlTypes.ConnectionPool | SqlTypes.Transaction;

let pool: SqlTypes.ConnectionPool;

function envFlag(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "sim"].includes(value.trim().toLowerCase());
}

function databaseName() {
  const name = process.env.DB_NAME ?? "compras_senai";
  if (!/^[a-zA-Z0-9_]+$/.test(name)) {
    throw new Error("DB_NAME deve conter apenas letras, numeros e sublinhado.");
  }
  return name;
}

function connectionConfig(database: string): SqlTypes.config {
  const trustedConnection = envFlag(process.env.DB_TRUSTED_CONNECTION, true);
  const instanceName = process.env.DB_INSTANCE?.trim() || "SQLEXPRESS";

  return {
    server: process.env.DB_SERVER?.trim() || "localhost",
    database,
    user: trustedConnection ? undefined : process.env.DB_USER,
    password: trustedConnection ? undefined : process.env.DB_PASSWORD,
    driver: process.env.DB_DRIVER?.trim() || "ODBC Driver 17 for SQL Server",
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30_000,
    },
    options: {
      instanceName,
      trustedConnection,
      trustServerCertificate: envFlag(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
      encrypt: envFlag(process.env.DB_ENCRYPT, false),
      enableArithAbort: true,
    },
  };
}

export async function query<T extends object = Record<string, unknown>>(
  statement: string,
  parameters: Record<string, unknown> = {},
  executor?: QueryExecutor,
) {
  if (!executor && !pool) {
    throw new Error("O banco de dados ainda nao foi inicializado.");
  }

  const request = executor instanceof sql.Transaction
    ? new sql.Request(executor)
    : new sql.Request(executor ?? pool);
  for (const [name, value] of Object.entries(parameters)) {
    request.input(name, value);
  }
  const result = await request.query<T>(statement);
  return result.recordset;
}

export async function withTransaction<T>(work: (transaction: SqlTypes.Transaction) => Promise<T>) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function initDatabase() {
  const name = databaseName();
  const masterPool = await new sql.ConnectionPool(connectionConfig("master")).connect();
  try {
    await masterPool.request().query(`IF DB_ID(N'${name}') IS NULL CREATE DATABASE [${name}]`);
  } finally {
    await masterPool.close();
  }

  pool = await new sql.ConnectionPool(connectionConfig(name)).connect();

  await pool.request().batch(`
    IF OBJECT_ID(N'dbo.users', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.users (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        email NVARCHAR(160) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
        password_hash NVARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CONSTRAINT CK_users_role CHECK (role IN ('professor', 'coordenacao')),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_users_created_at DEFAULT SYSDATETIME()
      );
    END;

    IF OBJECT_ID(N'dbo.cost_centers', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.cost_centers (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cost_centers PRIMARY KEY,
        code NVARCHAR(40) NOT NULL CONSTRAINT UQ_cost_centers_code UNIQUE,
        name NVARCHAR(140) NOT NULL
      );
    END;

    IF OBJECT_ID(N'dbo.catalog_items', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.catalog_items (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_catalog_items PRIMARY KEY,
        code NVARCHAR(80) NOT NULL CONSTRAINT UQ_catalog_items_code UNIQUE,
        description NVARCHAR(MAX) NOT NULL,
        cost_center_id INT NULL,
        source NVARCHAR(40) NOT NULL CONSTRAINT DF_catalog_items_source DEFAULT N'planilha',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_catalog_items_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_catalog_items_cost_centers FOREIGN KEY (cost_center_id) REFERENCES dbo.cost_centers(id)
      );
    END;

    IF OBJECT_ID(N'dbo.purchase_requests', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.purchase_requests (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_purchase_requests PRIMARY KEY,
        professor_id INT NOT NULL,
        catalog_item_id INT NULL,
        cost_center_id INT NOT NULL,
        item_type VARCHAR(20) NOT NULL CONSTRAINT CK_purchase_requests_item_type CHECK (item_type IN ('catalogo', 'novo')),
        quantity INT NOT NULL CONSTRAINT CK_purchase_requests_quantity CHECK (quantity > 0),
        justification NVARCHAR(MAX) NOT NULL,
        new_item_name NVARCHAR(180) NULL,
        new_item_description NVARCHAR(MAX) NULL,
        supplier_link NVARCHAR(MAX) NULL,
        status VARCHAR(40) NOT NULL CONSTRAINT CK_purchase_requests_status CHECK (
          status IN ('aguardando_coordenacao', 'novo_item_pendente', 'aprovada', 'recusada', 'ajuste_solicitado')
        ),
        coordinator_response NVARCHAR(MAX) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_purchase_requests_created_at DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_purchase_requests_updated_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_purchase_requests_users FOREIGN KEY (professor_id) REFERENCES dbo.users(id),
        CONSTRAINT FK_purchase_requests_catalog_items FOREIGN KEY (catalog_item_id) REFERENCES dbo.catalog_items(id),
        CONSTRAINT FK_purchase_requests_cost_centers FOREIGN KEY (cost_center_id) REFERENCES dbo.cost_centers(id)
      );
    END;

    IF OBJECT_ID(N'dbo.request_attachments', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.request_attachments (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_request_attachments PRIMARY KEY,
        request_id INT NOT NULL,
        kind VARCHAR(30) NOT NULL CONSTRAINT CK_request_attachments_kind CHECK (kind IN ('ficha_tecnica', 'foto')),
        original_name NVARCHAR(220) NOT NULL,
        stored_path NVARCHAR(260) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_request_attachments_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_request_attachments_requests FOREIGN KEY (request_id)
          REFERENCES dbo.purchase_requests(id) ON DELETE CASCADE
      );
    END;

    IF OBJECT_ID(N'dbo.notifications', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.notifications (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_notifications PRIMARY KEY,
        user_id INT NOT NULL,
        title NVARCHAR(160) NOT NULL,
        message NVARCHAR(MAX) NOT NULL,
        read_at DATETIME2 NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_notifications_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_notifications_users FOREIGN KEY (user_id) REFERENCES dbo.users(id)
      );
    END;
  `);

  await seedDefaults();
}

async function seedDefaults() {
  const usersCount = await query<{ total: number }>("SELECT COUNT(*) AS total FROM dbo.users");
  if (usersCount[0].total === 0) {
    const professorHash = await bcrypt.hash("professor123", 10);
    const coordHash = await bcrypt.hash("coordenacao123", 10);
    await query(
      `INSERT INTO dbo.users (name, email, password_hash, role)
       VALUES (@professorName, @professorEmail, @professorHash, 'professor'),
              (@coordinatorName, @coordinatorEmail, @coordinatorHash, 'coordenacao')`,
      {
        professorName: "Professor Demo",
        professorEmail: "professor@senai.local",
        professorHash,
        coordinatorName: "Coordenacao Demo",
        coordinatorEmail: "coordenacao@senai.local",
        coordinatorHash: coordHash,
      },
    );
  }

  const centersCount = await query<{ total: number }>("SELECT COUNT(*) AS total FROM dbo.cost_centers");
  if (centersCount[0].total === 0) {
    await query(
      `INSERT INTO dbo.cost_centers (code, name)
       VALUES ('CC-ADM', N'Administrativo'), ('CC-LAB', N'Laboratorios'), ('CC-DOC', N'Docencia')`,
    );
  }
}

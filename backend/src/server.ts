import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { extname, join } from "node:path";
import { Readable } from "node:stream";
import { TextDecoder } from "node:util";
import { requireAuth, requireRole, signToken } from "./auth.js";
import { initDatabase, query, withTransaction } from "./db.js";
import { assertAllowedSupplierLink, assertRequiredText, parsePositiveInt } from "./validators.js";

const app = express();
const port = Number(process.env.PORT ?? 3333);
const uploadDir = join(process.cwd(), "uploads");
mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

type ManagedUser = {
  id: number;
  name: string;
  email: string;
  role: "professor" | "coordenacao";
  active: boolean;
};

type CatalogItemInput = { code: string; description: string };

type CatalogParseResult = {
  found: number;
  ignored: number;
  items: CatalogItemInput[];
};

class CatalogFileError extends Error {}

const configuredOrigins = (process.env.CORS_ORIGINS ?? process.env.FRONTEND_URL ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedDevOrigin(origin) || configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
    },
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const password = String(req.body.password ?? "");
  const rows = await query<{
    id: number;
    name: string;
    email: string;
    password_hash: string;
    role: "professor" | "coordenacao";
    is_active: boolean;
  }>(
    "SELECT id, name, email, password_hash, role, is_active FROM dbo.users WHERE email = @email",
    { email },
  );
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ message: "E-mail ou senha invalidos." });
    return;
  }
  if (!user.is_active) {
    res.status(403).json({ message: "Usuario desativado. Entre em contato com a coordenacao." });
    return;
  }

  const authUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(authUser), user: authUser });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const rows = await query<{ id: number; name: string; email: string; role: "professor" | "coordenacao" }>(
    "SELECT id, name, email, role FROM dbo.users WHERE id = @userId",
    { userId: req.user?.id },
  );
  const user = rows[0];

  if (!user) {
    res.status(404).json({ message: "Usuario nao encontrado." });
    return;
  }

  res.json({ user });
});

app.patch("/api/me", requireAuth, async (req, res) => {
  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").trim().toLowerCase();

  if (!name || !email) {
    res.status(400).json({ message: "Preencha os campos obrigatorios." });
    return;
  }
  if (name.length > 120) {
    res.status(400).json({ message: "O nome deve ter no maximo 120 caracteres." });
    return;
  }
  if (email.length > 160 || !isValidEmail(email)) {
    res.status(400).json({ message: "Informe um e-mail valido." });
    return;
  }

  const duplicated = await query<{ id: number }>(
    "SELECT id FROM dbo.users WHERE email = @email AND id <> @userId",
    { email, userId: req.user?.id },
  );
  if (duplicated.length > 0) {
    res.status(409).json({ message: "Este e-mail ja esta em uso." });
    return;
  }

  try {
    const rows = await query<{ id: number; name: string; email: string; role: "professor" | "coordenacao" }>(
      `UPDATE dbo.users
       SET name = @name, email = @email
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role
       WHERE id = @userId`,
      { name, email, userId: req.user?.id },
    );
    const user = rows[0];

    if (!user) {
      res.status(404).json({ message: "Usuario nao encontrado." });
      return;
    }

    res.json({ message: "Perfil atualizado com sucesso.", user, token: signToken(user) });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ message: "Este e-mail ja esta em uso." });
      return;
    }
    throw error;
  }
});

app.patch("/api/me/password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword ?? "");
  const newPassword = String(req.body.newPassword ?? "");

  if (!currentPassword || !newPassword) {
    res.status(400).json({ message: "Preencha os campos obrigatorios." });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ message: "A nova senha deve ter no minimo 8 caracteres." });
    return;
  }

  const rows = await query<{ password_hash: string }>(
    "SELECT password_hash FROM dbo.users WHERE id = @userId",
    { userId: req.user?.id },
  );
  const user = rows[0];

  if (!user) {
    res.status(404).json({ message: "Usuario nao encontrado." });
    return;
  }
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    res.status(400).json({ message: "Senha atual incorreta." });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await query(
    "UPDATE dbo.users SET password_hash = @passwordHash WHERE id = @userId",
    { passwordHash, userId: req.user?.id },
  );
  res.json({ message: "Senha alterada com sucesso." });
});

app.get("/api/users", requireAuth, requireRole("coordenacao"), async (_req, res) => {
  const users = await query<ManagedUser>(
    `SELECT id, name, email, role, CAST(is_active AS BIT) AS active
     FROM dbo.users
     ORDER BY name, id`,
  );
  res.json(users);
});

app.post("/api/users", requireAuth, requireRole("coordenacao"), async (req, res) => {
  const validation = validateManagedUser(req.body, true);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }

  const { name, email, role, password } = validation.data;
  const duplicated = await query<{ id: number }>("SELECT id FROM dbo.users WHERE email = @email", { email });
  if (duplicated.length > 0) {
    res.status(409).json({ message: "Este e-mail ja esta sendo utilizado." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const users = await query<ManagedUser>(
      `INSERT INTO dbo.users (name, email, password_hash, role, is_active)
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role,
              CAST(INSERTED.is_active AS BIT) AS active
       VALUES (@name, @email, @passwordHash, @role, 1)`,
      { name, email, passwordHash, role },
    );
    res.status(201).json({ message: "Usuario criado com sucesso.", user: users[0] });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ message: "Este e-mail ja esta sendo utilizado." });
      return;
    }
    throw error;
  }
});

app.patch("/api/users/:id", requireAuth, requireRole("coordenacao"), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ message: "Usuario invalido." });
    return;
  }
  if (userId === Number(req.user?.id)) {
    res.status(400).json({ message: "Edite sua propria conta pela tela Meu perfil." });
    return;
  }

  const validation = validateManagedUser(req.body, false);
  if (!validation.ok) {
    res.status(400).json({ message: validation.message });
    return;
  }
  const { name, email, role } = validation.data;
  const duplicated = await query<{ id: number }>(
    "SELECT id FROM dbo.users WHERE email = @email AND id <> @userId",
    { email, userId },
  );
  if (duplicated.length > 0) {
    res.status(409).json({ message: "Este e-mail ja esta sendo utilizado." });
    return;
  }

  try {
    const users = await query<ManagedUser>(
      `UPDATE dbo.users
       SET name = @name, email = @email, role = @role
       OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role,
              CAST(INSERTED.is_active AS BIT) AS active
       WHERE id = @userId`,
      { name, email, role, userId },
    );
    if (!users[0]) {
      res.status(404).json({ message: "Usuario nao encontrado." });
      return;
    }
    res.json({ message: "Usuario atualizado com sucesso.", user: users[0] });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      res.status(409).json({ message: "Este e-mail ja esta sendo utilizado." });
      return;
    }
    throw error;
  }
});

app.patch("/api/users/:id/status", requireAuth, requireRole("coordenacao"), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0 || typeof req.body?.active !== "boolean") {
    res.status(400).json({ message: "Usuario ou status invalido." });
    return;
  }
  if (userId === Number(req.user?.id)) {
    res.status(400).json({ message: "Voce nao pode alterar o status da propria conta." });
    return;
  }

  const users = await query<ManagedUser>(
    `UPDATE dbo.users
     SET is_active = @active
     OUTPUT INSERTED.id, INSERTED.name, INSERTED.email, INSERTED.role,
            CAST(INSERTED.is_active AS BIT) AS active
     WHERE id = @userId`,
    { active: req.body.active, userId },
  );
  if (!users[0]) {
    res.status(404).json({ message: "Usuario nao encontrado." });
    return;
  }

  res.json({
    message: req.body.active ? "Usuario ativado com sucesso." : "Usuario desativado com sucesso.",
    user: users[0],
  });
});

app.get("/api/cost-centers", requireAuth, async (_req, res) => {
  const rows = await query("SELECT id, code, name FROM dbo.cost_centers ORDER BY code");
  res.json(rows);
});

app.get("/api/catalog", requireAuth, async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const like = `%${search}%`;
  const requestedLimit = Number(req.query.limit);
  const requestedOffset = Number(req.query.offset);
  const paginated = Number.isInteger(requestedLimit) || Number.isInteger(requestedOffset);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 40;
  const offset = Number.isInteger(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
  const rows = await query(
    `SELECT ${paginated ? "" : "TOP (40)"} ci.id, ci.code, ci.description, ci.source,
            cc.code AS costCenterCode, cc.name AS costCenterName
     FROM dbo.catalog_items ci
     LEFT JOIN dbo.cost_centers cc ON cc.id = ci.cost_center_id
     WHERE @search = N'' OR ci.code LIKE @like OR ci.description LIKE @like
     ORDER BY ci.description, ci.id
     ${paginated ? "OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY" : ""}`,
    { search, like, offset, limit },
  );
  res.json(rows);
});

app.post("/api/catalog/import/preview", requireAuth, requireRole("coordenacao"), upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Envie uma planilha XLSX ou CSV." });
    return;
  }

  try {
    const parsed = await parseCatalogFile(req.file.path, req.file.originalname);
    res.json({
      fileName: req.file.originalname,
      found: parsed.found,
      valid: parsed.items.length,
      ignored: parsed.ignored,
      preview: parsed.items.slice(0, 8),
    });
  } catch (error) {
    res.status(400).json({
      message: error instanceof CatalogFileError ? error.message : "Nao foi possivel interpretar o arquivo.",
    });
  } finally {
    await removeTemporaryFile(req.file.path);
  }
});

app.post("/api/catalog/import", requireAuth, requireRole("coordenacao"), upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Envie uma planilha XLSX ou CSV." });
    return;
  }

  try {
    const parsed = await parseCatalogFile(req.file.path, req.file.originalname);
    await withTransaction(async (transaction) => {
      await query("UPDATE dbo.purchase_requests SET catalog_item_id = NULL WHERE catalog_item_id IS NOT NULL", {}, transaction);
      await query("DELETE FROM dbo.catalog_items", {}, transaction);
      for (const item of parsed.items) {
        await query(
          "INSERT INTO dbo.catalog_items (code, description, source) VALUES (@code, @description, N'planilha')",
          item,
          transaction,
        );
      }
    });
    res.json({ message: "Catalogo importado com sucesso.", imported: parsed.items.length, ignored: parsed.ignored });
  } catch (error) {
    if (error instanceof CatalogFileError) {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error(error);
    res.status(500).json({ message: "Erro ao importar catalogo." });
  } finally {
    await removeTemporaryFile(req.file.path);
  }
});

app.get("/api/requests", requireAuth, async (req, res) => {
  const filter = req.user?.role === "professor" ? "WHERE pr.professor_id = @professorId" : "";
  const params = req.user?.role === "professor" ? { professorId: req.user.id } : {};
  const rows = await query(
    `SELECT pr.*, u.name as professorName, ci.code as catalogCode, ci.description as catalogDescription,
            cc.code as costCenterCode, cc.name as costCenterName
     FROM dbo.purchase_requests pr
     JOIN dbo.users u ON u.id = pr.professor_id
     LEFT JOIN dbo.catalog_items ci ON ci.id = pr.catalog_item_id
     JOIN dbo.cost_centers cc ON cc.id = pr.cost_center_id
     ${filter}
     ORDER BY pr.created_at DESC`,
    params,
  );
  res.json(rows);
});

app.post(
  "/api/requests/catalog",
  requireAuth,
  requireRole("professor"),
  async (req, res) => {
    try {
      const catalogItemId = parsePositiveInt(req.body.catalogItemId, "Item do catalogo");
      const costCenterId = parsePositiveInt(req.body.costCenterId, "Centro de custo");
      const quantity = parsePositiveInt(req.body.quantity, "Quantidade");
      const justification = assertRequiredText(req.body.justification, "Justificativa");

      const result = await query<{ id: number }>(
        `INSERT INTO dbo.purchase_requests
         (professor_id, catalog_item_id, cost_center_id, item_type, quantity, justification, status)
         OUTPUT INSERTED.id
         VALUES (@professorId, @catalogItemId, @costCenterId, 'catalogo', @quantity, @justification, 'aguardando_coordenacao')`,
        { professorId: req.user?.id, catalogItemId, costCenterId, quantity, justification },
      );

      res.status(201).json({
        id: result[0].id,
        message: "Solicitacao enviada. Aguarde retorno em ate 30 dias.",
      });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Dados invalidos." });
    }
  },
);

app.post(
  "/api/requests/new-item",
  requireAuth,
  requireRole("professor"),
  upload.fields([
    { name: "technicalFile", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const costCenterId = parsePositiveInt(req.body.costCenterId, "Centro de custo");
      const quantity = parsePositiveInt(req.body.quantity, "Quantidade");
      const justification = assertRequiredText(req.body.justification, "Justificativa");
      const newItemName = assertRequiredText(req.body.newItemName, "Nome do produto");
      const newItemDescription = assertRequiredText(req.body.newItemDescription, "Descricao do produto");
      const supplierLink = assertAllowedSupplierLink(req.body.supplierLink);

      const result = await query<{ id: number }>(
        `INSERT INTO dbo.purchase_requests
         (professor_id, cost_center_id, item_type, quantity, justification, new_item_name,
          new_item_description, supplier_link, status)
         OUTPUT INSERTED.id
         VALUES (@professorId, @costCenterId, 'novo', @quantity, @justification,
                 @newItemName, @newItemDescription, @supplierLink, 'novo_item_pendente')`,
        { professorId: req.user?.id, costCenterId, quantity, justification, newItemName, newItemDescription, supplierLink },
      );

      const requestId = result[0].id;
      const files = req.files as Record<string, Express.Multer.File[]>;
      await saveAttachment(requestId, files?.technicalFile?.[0], "ficha_tecnica");
      await saveAttachment(requestId, files?.photo?.[0], "foto");

      res.status(201).json({
        id: requestId,
        message: "Solicitacao de novo item enviada para a coordenacao.",
      });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Dados invalidos." });
    }
  },
);

app.patch("/api/requests/:id/review", requireAuth, requireRole("coordenacao"), async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  const response = assertRequiredText(req.body.response, "Resposta da coordenacao");
  const allowed = ["aprovada", "recusada", "ajuste_solicitado"];

  if (!allowed.includes(status) || !Number.isInteger(id)) {
    res.status(400).json({ message: "Status ou solicitacao invalida." });
    return;
  }

  const found = await withTransaction(async (transaction) => {
    const requests = await query<{
      professor_id: number;
      item_type: "catalogo" | "novo";
      catalog_item_id: number | null;
      cost_center_id: number;
      new_item_name: string | null;
      new_item_description: string | null;
    }>("SELECT * FROM dbo.purchase_requests WHERE id = @id", { id }, transaction);
    const request = requests[0];
    if (!request) return false;

    if (status === "aprovada" && request.item_type === "novo" && !request.catalog_item_id) {
      const code = `NOVO-${String(id).padStart(5, "0")}`;
      const catalogResult = await query<{ id: number }>(
        `INSERT INTO dbo.catalog_items (code, description, cost_center_id, source)
         OUTPUT INSERTED.id
         VALUES (@code, @description, @costCenterId, N'coordenacao')`,
        {
          code,
          description: request.new_item_description ?? request.new_item_name,
          costCenterId: request.cost_center_id,
        },
        transaction,
      );
      await query(
        "UPDATE dbo.purchase_requests SET catalog_item_id = @catalogItemId WHERE id = @id",
        { catalogItemId: catalogResult[0].id, id },
        transaction,
      );
    }

    await query(
      `UPDATE dbo.purchase_requests
       SET status = @status, coordinator_response = @response, updated_at = SYSDATETIME()
       WHERE id = @id`,
      { status, response, id },
      transaction,
    );
    await query(
      `INSERT INTO dbo.notifications (user_id, title, message)
       VALUES (@userId, @title, @message)`,
      {
        userId: request.professor_id,
        title: "Retorno da coordenacao",
        message: `Sua solicitacao #${id} foi atualizada para: ${status}. ${response}`,
      },
      transaction,
    );
    return true;
  });

  if (!found) {
    res.status(404).json({ message: "Solicitacao nao encontrada." });
    return;
  }

  res.json({ message: "Retorno registrado e professor notificado." });
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  const rows = await query(
    `SELECT id, title, message, read_at AS readAt, created_at AS createdAt
     FROM dbo.notifications WHERE user_id = @userId ORDER BY created_at DESC`,
    { userId: req.user?.id },
  );
  res.json(rows);
});

app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
  await query(
    "UPDATE dbo.notifications SET read_at = SYSDATETIME() WHERE user_id = @userId AND read_at IS NULL",
    { userId: req.user?.id },
  );
  res.json({ ok: true });
});

app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
  await query(
    "UPDATE dbo.notifications SET read_at = SYSDATETIME() WHERE id = @id AND user_id = @userId",
    { id: req.params.id, userId: req.user?.id },
  );
  res.json({ ok: true });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "Erro interno do servidor." });
});

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateManagedUser(body: unknown, requirePassword: boolean):
  | { ok: true; data: { name: string; email: string; role: ManagedUser["role"]; password: string } }
  | { ok: false; message: string } {
  const fields = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const name = String(fields.name ?? "").trim();
  const email = String(fields.email ?? "").trim().toLowerCase();
  const role = String(fields.role ?? "");
  const password = String(fields.password ?? "");

  if (!name || !email || (requirePassword && !password)) {
    return { ok: false, message: "Preencha os campos obrigatorios." };
  }
  if (name.length > 120) {
    return { ok: false, message: "O nome deve ter no maximo 120 caracteres." };
  }
  if (email.length > 160 || !isValidEmail(email)) {
    return { ok: false, message: "Informe um e-mail valido." };
  }
  if (role !== "professor" && role !== "coordenacao") {
    return { ok: false, message: "Perfil invalido." };
  }
  if (requirePassword && password.length < 8) {
    return { ok: false, message: "A senha deve ter no minimo 8 caracteres." };
  }

  return { ok: true, data: { name, email, role, password } };
}

function isUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const sqlError = error as { number?: number; originalError?: { info?: { number?: number } } };
  const number = sqlError.number ?? sqlError.originalError?.info?.number;
  return number === 2601 || number === 2627;
}

function normalizeKey(key: string) {
  return key
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isAllowedDevOrigin(origin: string) {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const { hostname, protocol } = new URL(origin);
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    const isPrivateLan =
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    return protocol.startsWith("http") && (isLocalhost || isPrivateLan);
  } catch {
    return false;
  }
}

async function saveAttachment(requestId: number, file: Express.Multer.File | undefined, kind: "ficha_tecnica" | "foto") {
  if (!file) return;
  await query(
    `INSERT INTO dbo.request_attachments (request_id, kind, original_name, stored_path)
     VALUES (@requestId, @kind, @originalName, @storedPath)`,
    { requestId, kind, originalName: file.originalname, storedPath: file.filename },
  );
}

async function parseCatalogFile(path: string, originalName: string): Promise<CatalogParseResult> {
  const extension = extname(originalName).toLowerCase();
  if (extension !== ".csv" && extension !== ".xlsx") {
    throw new CatalogFileError("Formato nao suportado. Envie um arquivo XLSX ou CSV.");
  }

  const workbook = new ExcelJS.Workbook();
  let worksheet: ExcelJS.Worksheet | undefined;

  try {
    if (extension === ".csv") {
      const content = decodeCsvContent(await readFile(path));
      if (!content.trim()) throw new CatalogFileError("Arquivo vazio.");
      if (content.includes("\0")) throw new CatalogFileError("Nao foi possivel interpretar o arquivo CSV.");
      const delimiter = detectCsvDelimiter(content);
      worksheet = await workbook.csv.read(Readable.from([content]), { parserOptions: { delimiter } });
    } else {
      await workbook.xlsx.readFile(path);
      worksheet = workbook.worksheets[0];
    }
  } catch (error) {
    if (error instanceof CatalogFileError) throw error;
    throw new CatalogFileError(
      extension === ".csv" ? "Nao foi possivel interpretar o arquivo CSV." : "Nao foi possivel interpretar o arquivo XLSX.",
    );
  }

  if (!worksheet || worksheet.actualRowCount === 0) {
    throw new CatalogFileError("Arquivo vazio.");
  }

  return parseCatalogWorksheet(worksheet);
}

function decodeCsvContent(content: Buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(content);
  } catch {
    return new TextDecoder("windows-1252").decode(content);
  }
}

function parseCatalogWorksheet(worksheet: ExcelJS.Worksheet): CatalogParseResult {
  const codeAliases = new Set(["codigo", "cod", "code", "item", "cod_item", "codigo_item"]);
  const descriptionAliases = new Set(["descricao", "description", "nome", "produto", "item_descricao"]);
  let headerRowNumber = 0;
  let codeIndex = 0;
  let descriptionIndex = 0;
  let hasContent = false;

  for (let rowNumber = 1; rowNumber <= Math.min(worksheet.rowCount, 20); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!rowHasContent(row)) continue;
    hasContent = true;
    const normalizedHeaders = Array.from({ length: row.cellCount }, (_, index) => (
      normalizeKey(row.getCell(index + 1).text)
    ));
    const foundCodeIndex = normalizedHeaders.findIndex((header) => codeAliases.has(header)) + 1;
    const foundDescriptionIndex = normalizedHeaders.findIndex((header) => descriptionAliases.has(header)) + 1;
    if (foundCodeIndex && foundDescriptionIndex && foundCodeIndex !== foundDescriptionIndex) {
      headerRowNumber = rowNumber;
      codeIndex = foundCodeIndex;
      descriptionIndex = foundDescriptionIndex;
      break;
    }
  }
  if (!headerRowNumber && !hasContent) throw new CatalogFileError("Arquivo vazio.");
  if (!headerRowNumber) {
    throw new CatalogFileError("Nao foi possivel identificar as colunas Codigo e Descricao.");
  }

  const items: CatalogItemInput[] = [];
  let found = 0;
  let ignored = 0;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!rowHasContent(row)) continue;
    found += 1;

    const code = row.getCell(codeIndex).text.trim();
    const description = row.getCell(descriptionIndex).text.trim();
    if (!code || !description) {
      ignored += 1;
      continue;
    }
    items.push({ code, description });
  }

  if (items.length === 0) {
    throw new CatalogFileError("Nenhum registro valido encontrado.");
  }

  return { found, ignored, items };
}

function rowHasContent(row: ExcelJS.Row) {
  for (let column = 1; column <= row.cellCount; column += 1) {
    if (row.getCell(column).text.trim()) return true;
  }
  return false;
}

function detectCsvDelimiter(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim()).slice(0, 10);
  if (lines.length === 0) throw new CatalogFileError("Arquivo vazio.");

  const candidates = [",", ";", "\t"].map((delimiter) => {
    const counts = lines.map((line) => countDelimiterOutsideQuotes(line, delimiter));
    const headerCount = counts[0];
    const matching = counts.filter((count) => count === headerCount).length;
    return { delimiter, headerCount, consistency: matching / counts.length };
  }).filter((candidate) => candidate.headerCount > 0)
    .sort((first, second) => second.consistency - first.consistency || second.headerCount - first.headerCount);

  const best = candidates[0];
  const second = candidates[1];
  if (!best || best.consistency < 0.6) {
    throw new CatalogFileError("Nao foi possivel identificar com seguranca o separador do arquivo CSV.");
  }
  if (second && second.consistency === best.consistency && second.headerCount === best.headerCount) {
    throw new CatalogFileError("Nao foi possivel identificar com seguranca o separador do arquivo CSV.");
  }
  return best.delimiter;
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      count += 1;
    }
  }
  return count;
}

async function removeTemporaryFile(path: string) {
  await unlink(path).catch(() => undefined);
}

initDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`API pronta em http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao iniciar banco/API", error);
    process.exit(1);
  });

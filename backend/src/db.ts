import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "compras",
  password: process.env.DB_PASSWORD ?? "compras",
  database: process.env.DB_NAME ?? "compras_senai",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('professor', 'coordenacao') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cost_centers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(40) NOT NULL UNIQUE,
      name VARCHAR(140) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(80) NOT NULL UNIQUE,
      description TEXT NOT NULL,
      cost_center_id INT NULL,
      source VARCHAR(40) NOT NULL DEFAULT 'planilha',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      professor_id INT NOT NULL,
      catalog_item_id INT NULL,
      cost_center_id INT NOT NULL,
      item_type ENUM('catalogo', 'novo') NOT NULL,
      quantity INT NOT NULL,
      justification TEXT NOT NULL,
      new_item_name VARCHAR(180) NULL,
      new_item_description TEXT NULL,
      supplier_link TEXT NULL,
      status ENUM('aguardando_coordenacao', 'novo_item_pendente', 'aprovada', 'recusada', 'ajuste_solicitado') NOT NULL,
      coordinator_response TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (professor_id) REFERENCES users(id),
      FOREIGN KEY (catalog_item_id) REFERENCES catalog_items(id),
      FOREIGN KEY (cost_center_id) REFERENCES cost_centers(id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS request_attachments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      kind ENUM('ficha_tecnica', 'foto') NOT NULL,
      original_name VARCHAR(220) NOT NULL,
      stored_path VARCHAR(260) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(160) NOT NULL,
      message TEXT NOT NULL,
      read_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await seedDefaults();
}

async function seedDefaults() {
  const [[usersCount]] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as total FROM users");
  if (usersCount.total === 0) {
    const professorHash = await bcrypt.hash("professor123", 10);
    const coordHash = await bcrypt.hash("coordenacao123", 10);
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?), (?, ?, ?, ?)",
      [
        "Professor Demo",
        "professor@senai.local",
        professorHash,
        "professor",
        "Coordenacao Demo",
        "coordenacao@senai.local",
        coordHash,
        "coordenacao",
      ],
    );
  }

  const [[centersCount]] = await pool.query<mysql.RowDataPacket[]>("SELECT COUNT(*) as total FROM cost_centers");
  if (centersCount.total === 0) {
    await pool.query(
      "INSERT INTO cost_centers (code, name) VALUES (?, ?), (?, ?), (?, ?)",
      ["CC-ADM", "Administrativo", "CC-LAB", "Laboratorios", "CC-DOC", "Docencia"],
    );
  }
}

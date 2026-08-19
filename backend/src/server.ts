import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import multer from "multer";
import ExcelJS from "exceljs";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type mysql from "mysql2/promise";
import { requireAuth, requireRole, signToken } from "./auth.js";
import { initDatabase, pool } from "./db.js";
import { assertAllowedSupplierLink, assertRequiredText, parsePositiveInt } from "./validators.js";

const app = express();
const port = Number(process.env.PORT ?? 3333);
const uploadDir = join(process.cwd(), "uploads");
mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

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
  const [rows] = await pool.query<mysql.RowDataPacket[]>("SELECT * FROM users WHERE email = ?", [email]);
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ message: "E-mail ou senha invalidos." });
    return;
  }

  const authUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ token: signToken(authUser), user: authUser });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/cost-centers", requireAuth, async (_req, res) => {
  const [rows] = await pool.query("SELECT id, code, name FROM cost_centers ORDER BY code");
  res.json(rows);
});

app.get("/api/catalog", requireAuth, async (req, res) => {
  const search = String(req.query.search ?? "").trim();
  const like = `%${search}%`;
  const [rows] = await pool.query(
    `SELECT ci.id, ci.code, ci.description, ci.source, cc.code as costCenterCode, cc.name as costCenterName
     FROM catalog_items ci
     LEFT JOIN cost_centers cc ON cc.id = ci.cost_center_id
     WHERE ? = '' OR ci.code LIKE ? OR ci.description LIKE ?
     ORDER BY ci.description
     LIMIT 40`,
    [search, like, like],
  );
  res.json(rows);
});

app.post("/api/catalog/import", requireAuth, requireRole("coordenacao"), upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "Envie uma planilha XLSX ou CSV." });
    return;
  }

  const rows = await readSpreadsheetRows(req.file.path, req.file.originalname);

  const items = rows
    .map((row) => normalizeCatalogRow(row))
    .filter((item): item is { code: string; description: string } => Boolean(item));

  if (items.length === 0) {
    res.status(400).json({ message: "Nenhum item com codigo e descricao foi encontrado." });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("UPDATE purchase_requests SET catalog_item_id = NULL WHERE catalog_item_id IS NOT NULL");
    await connection.query("DELETE FROM catalog_items");
    for (const item of items) {
      await connection.query("INSERT INTO catalog_items (code, description, source) VALUES (?, ?, 'planilha')", [
        item.code,
        item.description,
      ]);
    }
    await connection.commit();
    res.json({ imported: items.length });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

app.get("/api/requests", requireAuth, async (req, res) => {
  const filter = req.user?.role === "professor" ? "WHERE pr.professor_id = ?" : "";
  const params = req.user?.role === "professor" ? [req.user.id] : [];
  const [rows] = await pool.query(
    `SELECT pr.*, u.name as professorName, ci.code as catalogCode, ci.description as catalogDescription,
            cc.code as costCenterCode, cc.name as costCenterName
     FROM purchase_requests pr
     JOIN users u ON u.id = pr.professor_id
     LEFT JOIN catalog_items ci ON ci.id = pr.catalog_item_id
     JOIN cost_centers cc ON cc.id = pr.cost_center_id
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

      const [result] = await pool.query<mysql.ResultSetHeader>(
        `INSERT INTO purchase_requests
         (professor_id, catalog_item_id, cost_center_id, item_type, quantity, justification, status)
         VALUES (?, ?, ?, 'catalogo', ?, ?, 'aguardando_coordenacao')`,
        [req.user?.id, catalogItemId, costCenterId, quantity, justification],
      );

      res.status(201).json({
        id: result.insertId,
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

      const [result] = await pool.query<mysql.ResultSetHeader>(
        `INSERT INTO purchase_requests
         (professor_id, cost_center_id, item_type, quantity, justification, new_item_name,
          new_item_description, supplier_link, status)
         VALUES (?, ?, 'novo', ?, ?, ?, ?, ?, 'novo_item_pendente')`,
        [req.user?.id, costCenterId, quantity, justification, newItemName, newItemDescription, supplierLink],
      );

      const files = req.files as Record<string, Express.Multer.File[]>;
      await saveAttachment(result.insertId, files?.technicalFile?.[0], "ficha_tecnica");
      await saveAttachment(result.insertId, files?.photo?.[0], "foto");

      res.status(201).json({
        id: result.insertId,
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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.query<mysql.RowDataPacket[]>("SELECT * FROM purchase_requests WHERE id = ?", [id]);
    const request = requests[0];
    if (!request) {
      res.status(404).json({ message: "Solicitacao nao encontrada." });
      return;
    }

    if (status === "aprovada" && request.item_type === "novo" && !request.catalog_item_id) {
      const code = `NOVO-${String(id).padStart(5, "0")}`;
      const [catalogResult] = await connection.query<mysql.ResultSetHeader>(
        "INSERT INTO catalog_items (code, description, cost_center_id, source) VALUES (?, ?, ?, 'coordenacao')",
        [code, request.new_item_description ?? request.new_item_name, request.cost_center_id],
      );
      await connection.query("UPDATE purchase_requests SET catalog_item_id = ? WHERE id = ?", [catalogResult.insertId, id]);
    }

    await connection.query("UPDATE purchase_requests SET status = ?, coordinator_response = ? WHERE id = ?", [
      status,
      response,
      id,
    ]);
    await connection.query("INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)", [
      request.professor_id,
      "Retorno da coordenacao",
      `Sua solicitacao #${id} foi atualizada para: ${status}. ${response}`,
    ]);
    await connection.commit();
    res.json({ message: "Retorno registrado e professor notificado." });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

app.get("/api/notifications", requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, title, message, read_at as readAt, created_at as createdAt FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
    [req.user?.id],
  );
  res.json(rows);
});

app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
  await pool.query(
    "UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL",
    [req.user?.id],
  );
  res.json({ ok: true });
});

app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
  await pool.query("UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?", [
    req.params.id,
    req.user?.id,
  ]);
  res.json({ ok: true });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ message: "Erro interno do servidor." });
});

function normalizeCatalogRow(row: Record<string, unknown>) {
  const entries = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[normalizeKey(key)] = String(value ?? "").trim();
    return acc;
  }, {});

  const code = entries.codigo || entries.cod || entries.code || entries.item || "";
  const description = entries.descricao || entries.description || entries.descrio || entries.nome || "";

  if (!code || !description) {
    return null;
  }

  return { code, description };
}

function normalizeKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
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
  await pool.query(
    "INSERT INTO request_attachments (request_id, kind, original_name, stored_path) VALUES (?, ?, ?, ?)",
    [requestId, kind, file.originalname, file.filename],
  );
}

async function readSpreadsheetRows(path: string, originalName: string) {
  const workbook = new ExcelJS.Workbook();
  if (originalName.toLowerCase().endsWith(".csv")) {
    const worksheet = await workbook.csv.readFile(path);
    return worksheetToObjects(worksheet);
  }

  await workbook.xlsx.readFile(path);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  return worksheetToObjects(worksheet);
}

function worksheetToObjects(worksheet: ExcelJS.Worksheet) {
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values as Array<string | number | undefined>;
  const normalizedHeaders = headers.map((value) => normalizeKey(String(value ?? "")));
  const rows: Record<string, unknown>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values as Array<string | number | undefined>;
    const item: Record<string, unknown> = {};
    normalizedHeaders.forEach((header, index) => {
      if (!header) return;
      item[header] = values[index] ?? "";
    });
    rows.push(item);
  });

  return rows;
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

import type { Request, RequestHandler } from "express";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import multer from "multer";
import {
  getAttachmentsBySheet,
  insertAttachmentForSheet,
  deleteAttachmentFromSheet,
  getAttachmentById,
  type DBAttachmentRow,
} from "@/backend/services/attachmentsService";
import { HttpError, getErrorMessage } from "@/utils/errors";

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "data/uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

/* ---------- Multer (disk) ---------- */

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const rand = crypto.randomBytes(16).toString("hex");
    cb(null, `${Date.now()}_${rand}${ext}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 20 },
}).array("files", 20);

/* ---------- Helpers ---------- */

function buildViewUrl(attachmentId: number): string {
  return `/api/backend/attachments/${attachmentId}/view`;
}

function toDTO(row: DBAttachmentRow, sheetId?: number) {
  return {
    AttachmentID: row.AttachmentID,
    SheetID: sheetId ?? row.SheetID ?? 0,
    FileName: row.OriginalName,
    StoredName: row.StoredName,
    MimeType: row.ContentType,
    SizeBytes: Number(row.FileSizeBytes),
    Url: buildViewUrl(row.AttachmentID),
    CreatedAt:
      row.UploadedAt instanceof Date ? row.UploadedAt.toISOString() : String(row.UploadedAt),
    CreatedBy: row.UploadedBy ?? null,
  };
}

type HttpErrorLike = HttpError & { status?: number; statusCode?: number };
function httpStatus(e: unknown): number {
  if (e instanceof HttpError) {
    const he = e as HttpErrorLike;
    return he.statusCode ?? he.status ?? 500;
  }
  return 500;
}

function getUserIdFromReq(req: Request): number | null {
  const u = (req as unknown as { user?: { userId?: number } }).user;
  return typeof u?.userId === "number" ? u.userId : null;
}

/* ---------- Controllers ---------- */

// GET /sheets/:sheetId/attachments
export const listBySheet: RequestHandler = async (req, res) => {
  const sheetId = Number(req.params.sheetId);
  if (!Number.isFinite(sheetId)) return res.status(400).json({ error: "Invalid sheetId" });

  try {
    const rows = await getAttachmentsBySheet(sheetId);
    const dtos = rows.map((r) => toDTO(r, sheetId));
    return res.json(dtos);
  } catch (err: unknown) {
    return res.status(httpStatus(err)).json({ error: getErrorMessage(err) });
  }
};

// POST /sheets/:sheetId/attachments
export const uploadToSheet: RequestHandler = async (req, res) => {
  const sheetId = Number(req.params.sheetId);
  if (!Number.isFinite(sheetId)) return res.status(400).json({ error: "Invalid sheetId" });

  const files = (req.files ?? []) as Express.Multer.File[];
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  const userId = getUserIdFromReq(req);

  try {
    const created = [];
    for (const f of files) {
      const row = await insertAttachmentForSheet(sheetId, {
        storedName: f.filename,
        originalName: f.originalname,
        mimeType: f.mimetype || "application/octet-stream",
        sizeBytes: f.size ?? 0,
        uploadedBy: userId ?? undefined,
        orderIndex: null,
        sha256: null, // compute if you want
      });
      created.push(toDTO(row, sheetId));
    }
    return res.status(201).json(created);
  } catch (err: unknown) {
    // best-effort cleanup
    for (const f of files) {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, f.filename)); } catch { /* ignore */ }
    }
    return res.status(httpStatus(err)).json({ error: getErrorMessage(err) });
  }
};

// DELETE /sheets/:sheetId/attachments/:attachmentId
export const deleteFromSheet: RequestHandler = async (req, res) => {
  const sheetId = Number(req.params.sheetId);
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(sheetId) || !Number.isFinite(attachmentId)) {
    return res.status(400).json({ error: "Invalid ids" });
  }

  try {
    const { orphaned, storedName } = await deleteAttachmentFromSheet(sheetId, attachmentId);

    if (orphaned && storedName) {
      const full = path.join(UPLOADS_DIR, storedName);
      fs.promises.unlink(full).catch(() => {});
    }

    return res.status(204).end();
  } catch (err: unknown) {
    return res.status(httpStatus(err)).json({ error: getErrorMessage(err) });
  }
};

// GET /attachments/:attachmentId/view?disposition=inline|attachment
export const streamAttachment: RequestHandler = async (req, res) => {
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isFinite(attachmentId)) return res.status(400).json({ error: "Invalid attachmentId" });

  try {
    const row = await getAttachmentById(attachmentId);
    if (!row) return res.status(404).json({ error: "Attachment not found" });

    const filePath = path.join(UPLOADS_DIR, row.StoredName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File missing on server" });

    const mime = row.ContentType || "application/octet-stream";
    const disp =
      (String(req.query.disposition || "") || "").toLowerCase() === "attachment"
        ? "attachment"
        : "inline";
    const safeName = path.basename(row.OriginalName || `file-${attachmentId}`);

    res.setHeader("Content-Type", mime);
    // Prefer DB size; fallback to fs
    const size = Number(row.FileSizeBytes) || fs.statSync(filePath).size;
    res.setHeader("Content-Length", String(size));
    res.setHeader("Content-Disposition", `${disp}; filename*=UTF-8''${encodeURIComponent(safeName)}`);

    fs.createReadStream(filePath).on("error", () => res.status(500).end()).pipe(res);
  } catch (err: unknown) {
    return res.status(httpStatus(err)).json({ error: getErrorMessage(err) });
  }
};

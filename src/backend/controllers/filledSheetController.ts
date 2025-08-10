// src/backend/controllers/filledSheetController.ts
import { Request, RequestHandler, Response } from "express";
import type { UserSession } from "@/types/session";
import type { AuditContext } from "@/types/audit";
import type { UnifiedSheet } from "@/types/sheet";
import { 
  fetchReferenceOptions, 
  fetchAllFilled, 
  createFilledSheet,
  getFilledSheetDetailsById,
  updateFilledSheet,
  verifyFilledSheet,
  approveFilledSheet,
  getFilledAuditEntries
} from "../services/filledSheetService";
import { generateDatasheetPDF } from "@/utils/generateDatasheetPDF";
import { generateDatasheetExcel } from "@/utils/generateDatasheetExcel";
import { getSheetNotes } from "@/backend/services/sheetNotesService";
import { getAttachmentsBySheet } from "@/backend/services/attachmentsService";
import type { AttachmentDTO } from "@/types/attachments";
import { duplicateSheet, createRevision, type LinkPolicy } from "@/backend/services/sheetVersioningService";
import { HttpError } from "@/utils/errors";
import { getUserId } from "@/types/auth";

function mapDbRowToDTO(
  row: {
    AttachmentID: number;
    OriginalName: string;
    StoredName: string;
    ContentType: string;
    FileSizeBytes: number | string;
    UploadedAt: Date | string;
    UploadedBy: number | null;
  },
  sheetId: number
): AttachmentDTO {
  const uploadedAt =
    row.UploadedAt instanceof Date ? row.UploadedAt.toISOString() : String(row.UploadedAt);

  return {
    AttachmentID: row.AttachmentID,
    SheetID: sheetId,
    FileName: row.OriginalName,
    StoredName: row.StoredName,
    MimeType: row.ContentType,
    SizeBytes: Number(row.FileSizeBytes),
    Url: `/api/backend/attachments/view/${row.AttachmentID}`, // your view route
    CreatedAt: uploadedAt,
    CreatedBy: row.UploadedBy ?? null,
  };
}

// DB row shape your attachments service can return
type DBAttachmentRow = {
  AttachmentID: number;
  OriginalName: string;
  StoredName: string;
  ContentType: string;
  FileSizeBytes: number | string;
  UploadedAt: Date | string;
  UploadedBy: number | null;
};

function isAttachmentDTO(x: unknown): x is AttachmentDTO {
  return typeof x === "object" && x !== null && "FileName" in x && "MimeType" in x && "Url" in x;
}

function isDBAttachmentRow(x: unknown): x is DBAttachmentRow {
  return typeof x === "object" && x !== null && "OriginalName" in x && "ContentType" in x;
}

export const getAllFilled = async (req: Request, res: Response) => {
  try {
    const result = await fetchAllFilled();
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Failed to fetch filled sheets:", err);
    res.status(500).json({ error: "Failed to fetch filled sheets" });
  }
};

export const createFilledSheetHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const sheetData = req.body as UnifiedSheet & { fieldValues: Record<string, string> };

    const auditContext: AuditContext = {
      userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || "",
      route: req.originalUrl,
      method: req.method,
    };

    const result = await createFilledSheet(sheetData, auditContext);

    res.status(201).json({ sheetId: result.sheetId }); // ✅ no `return`
  } catch (err) {
    console.error("❌ Failed to create filled sheet:", err);
    res.status(500).json({ error: "Failed to create filled sheet" });
  }
};

export const getFilledSheetById = async (req: Request, res: Response) => {
  const sheetId = parseInt(req.params.id);
  const lang = req.query.lang?.toString() || "eng";

  if (!sheetId || isNaN(sheetId)) {
    res.status(400).json({ error: "Invalid Sheet ID" });
    return;
  }

  try {
    const result = await getFilledSheetDetailsById(sheetId, lang);
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error fetching filled sheet:", err);
    res.status(500).json({ error: "Failed to fetch filled sheet" });
  }
};

export const getFilledAudit: RequestHandler = async (req, res) => {
  try {
    const sheetId = parseInt(req.params.id, 10);
    if (Number.isNaN(sheetId)) {
      res.status(400).json({ error: "Invalid Sheet ID" });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const entries = await getFilledAuditEntries(sheetId, limit, offset);
    res.json({ entries, limit, offset });
  } catch (err) {
    console.error("[getFilledAudit] error:", err);
    res.status(500).json({ error: "Failed to fetch filled audit." });
  }
};

export const updateFilledSheetHandler = async (req: Request, res: Response): Promise<void> => {
  const sheetId = Number(req.params.id);
  if (!sheetId || isNaN(sheetId)) {
    res.status(400).json({ error: "Invalid sheet ID" });
    return;
  }

  const user = req.user as UserSession;
  const userId = user?.userId;
  if (!userId) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  try {
    const updated = await updateFilledSheet(sheetId, req.body, userId);
    res.status(200).json({ sheetId: updated.sheetId });
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("❌ Update failed:", err.message);
      res.status(500).json({ error: err.message });
    } else {
      console.error("❌ Unknown error during update:", err);
      res.status(500).json({ error: "Unexpected error occurred." });
    }
  }
};

export const verifyFilledSheetHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheetId = parseInt(req.params.id);
    const { action, rejectionComment } = req.body;

    const user = req.user!;
    const userId = user.userId;

    if (!["verify", "reject"].includes(action)) {
      res.status(400).json({ error: "Invalid action" });
      return;
    }

    await verifyFilledSheet(sheetId, action, rejectionComment, userId);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Error verifying filled sheet:", err);
    res.status(500).json({ error: "Failed to verify/reject filled sheet." });
  }
};

export const approveFilledSheetHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheetId = parseInt(req.params.id);
    const userId = (req.user as { userId: number }).userId;

    if (!sheetId || isNaN(sheetId)) {
      res.status(400).json({ error: "Invalid sheet ID" });
      return;
    }

    await approveFilledSheet(sheetId, userId);

    res.status(200).json({ sheetId });
  } catch (error) {
    console.error("❌ Error approving filled sheet:", error);
    res.status(500).json({ error: "Failed to approve filled sheet" });
  }
};

export const getReferenceOptions = async (req: Request, res: Response) => {
  try {
    const data = await fetchReferenceOptions();
    res.status(200).json(data);
  } catch (err) {
    console.error("❌ Failed to fetch reference options:", err);
    res.status(500).json({ error: "Failed to fetch reference options" });
  }
};

// ✅ PDF export handler
export const exportFilledSheetPDF = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheetId = parseInt(req.params.id, 10);
    const lang = String(req.query.lang || "eng");
    const uom = (String(req.query.uom || "SI").toUpperCase() as "SI" | "USC");

    if (!Number.isFinite(sheetId) || sheetId <= 0) {
      res.status(400).send("Invalid sheet id.");
      return;
    }

    const result = await getFilledSheetDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).send("Sheet not found.");
      return;
    }

    const { datasheet } = result;

    // ⬇️ NEW: load notes + attachments on the server
    const [notes, attachmentsDb] = await Promise.all([
      getSheetNotes(sheetId),
      getAttachmentsBySheet(sheetId), // returns DB rows
    ]);

    const attachments: AttachmentDTO[] = attachmentsDb.map((r) => mapDbRowToDTO(r, sheetId));

    // ⬇️ Pass them into the PDF generator
    const { buffer, fileName } = await generateDatasheetPDF(datasheet, lang, uom, {
      notes,
      attachments, // now correct shape
      allowNetworkFetch: true,
      authCookie: req.headers.cookie ?? "",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error exporting filled sheet PDF:", error);
    res.status(500).send("Failed to generate PDF.");
  }
};

// ✅ Excel export handler
export const exportFilledSheetExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheetId = Number.parseInt(req.params.id, 10);
    const lang = String(req.query.lang || "eng");
    const uom = (String(req.query.uom || "SI").toUpperCase() as "SI" | "USC");

    const result = await getFilledSheetDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).send("Sheet not found.");
      return;
    }
    const { datasheet } = result;

    // Pull notes + attachments (normalize to AttachmentDTO[])
    const [notes, attachmentsRaw] = await Promise.all([
      getSheetNotes(sheetId),
      getAttachmentsBySheet(sheetId),
    ]);
    const attachments: AttachmentDTO[] = (attachmentsRaw as unknown[]).map((r) => {
      if (isAttachmentDTO(r)) return r;
      if (isDBAttachmentRow(r)) return mapDbRowToDTO(r, sheetId);
      throw new Error("Unexpected attachment row shape");
    });

    const buffer = await generateDatasheetExcel(datasheet, lang, uom, { notes, attachments });

    // Filename
    const clean = (s: string | number | null | undefined) =>
      String(s ?? "").replace(/[\/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
    const sheetType = datasheet.isTemplate ? "Template" : "FilledSheet";
    const fileName = `${clean(sheetType)}-${clean(datasheet.clientName)}-${clean(
      datasheet.sheetName
    )}-RevNo-${clean(datasheet.revisionNum)}-${uom}-${lang}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error exporting filled sheet Excel:", error);
    res.status(500).send("Failed to generate Excel.");
  }
};

export const duplicateFilledSheet: RequestHandler = async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id, 10);
    const userId = getUserId(req);
    const linkPolicy = (req.query.linkPolicy as LinkPolicy) ?? "link";

    const newSheetId = await duplicateSheet({
      sourceId,
      userId,
      isTemplate: false,
      linkPolicy,
    });

    res.status(201).json({ newSheetId });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "Failed to duplicate filled sheet";
    const code = err instanceof HttpError ? err.status : 500;
    res.status(code).json({ error: msg });
  }
};

export const createFilledSheetRevision: RequestHandler = async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id, 10);
    const userId = getUserId(req);
    const linkPolicy = (req.query.linkPolicy as LinkPolicy) ?? "link";

    const newSheetId = await createRevision({
      sourceId,
      userId,
      isTemplate: false,
      linkPolicy,
    });

    res.status(201).json({ newSheetId });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "Failed to create revision";
    const code = err instanceof HttpError ? err.status : 500;
    res.status(code).json({ error: msg });
  }
};
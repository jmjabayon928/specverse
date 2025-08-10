// src/backend/controllers/templateController.ts

import { Request, Response, RequestHandler } from "express";
import { poolPromise } from "../config/db";
import { unifiedSheetSchema } from "@/validation/sheetSchema";
import { 
  createTemplate, 
  updateTemplate, 
  verifyTemplate, 
  approveTemplate,
  getTemplateDetailsById, 
  getTemplateAuditEntries
} from "../services/templateService";
import { generateDatasheetPDF } from "@/utils/generateDatasheetPDF";
import { generateDatasheetExcel } from "@/utils/generateDatasheetExcel";
import { getSheetNotes } from "@/backend/services/sheetNotesService";
import { getAttachmentsBySheet } from "@/backend/services/attachmentsService";
import type { AttachmentDTO } from "@/types/attachments";
import { duplicateSheet, createRevision, type LinkPolicy } from "@/backend/services/sheetVersioningService";
import { HttpError } from "@/utils/errors";
import { getUserId } from "@/types/auth";

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
  return typeof x === "object" && x !== null && "FileName" in x && "MimeType" in x;
}

function isDBAttachmentRow(x: unknown): x is DBAttachmentRow {
  return typeof x === "object" && x !== null && "OriginalName" in x && "ContentType" in x;
}

function mapDbRowToDTO(row: DBAttachmentRow, sheetId: number): AttachmentDTO {
  const createdAt =
    row.UploadedAt instanceof Date ? row.UploadedAt.toISOString() : String(row.UploadedAt);
  return {
    AttachmentID: row.AttachmentID,
    SheetID: sheetId,
    FileName: row.OriginalName,
    StoredName: row.StoredName,
    MimeType: row.ContentType,
    SizeBytes: Number(row.FileSizeBytes),
    Url: `/api/backend/attachments/view/${row.AttachmentID}`,
    CreatedAt: createdAt,
    CreatedBy: row.UploadedBy ?? null,
  };
}

export const createTemplateHandler = async (req: Request, res: Response) => {
  try {
    const sheet = unifiedSheetSchema.parse(req.body);
    const userId = (req.user as { userId: number }).userId;

    const sheetId = await createTemplate(sheet, userId);

    res.status(200).json({ message: "Template created", sheetId }); // ✅ Don't `return`
  } catch (err) {
    console.error("❌ createTemplateHandler error:", err);
    res.status(400).json({ error: (err as Error).message }); // ✅ Don't `return`
  }
};

export const editTemplate: RequestHandler = async (req, res): Promise<void> => {
  try {
    const sheet = unifiedSheetSchema.parse(req.body);
    const sheetId = parseInt(req.params.id, 10);
    if (isNaN(sheetId)) {
      res.status(400).json({ error: "Invalid Sheet ID" });
      return;
    }

    const userId = (req.user as { userId: number }).userId;
    const updatedId = await updateTemplate(sheetId, sheet, userId);

    res.status(200).json({ sheetId: updatedId }); // ✅ frontend expects this!
  } catch (err) {
    console.error("❌ editTemplate error:", err);
    res.status(400).json({ error: (err as Error).message });
  }
};

export const getTemplateAudit: RequestHandler = async (req, res) => {
  try {
    const sheetId = parseInt(req.params.id, 10);
    if (Number.isNaN(sheetId)) {
      res.status(400).json({ error: "Invalid Sheet ID" });
      return;
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const entries = await getTemplateAuditEntries(sheetId, limit, offset);
    res.json({ entries, limit, offset });
  } catch (err) {
    console.error("[getTemplateAudit] error:", err);
    res.status(500).json({ error: "Failed to fetch template audit." });
  }
};

export const getTemplateDetailForEdit: RequestHandler = async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);

    if (isNaN(templateId)) {
      console.warn("⚠️ Invalid template ID in getTemplateDetailForEdit:", req.params.id);
      res.status(400).json({ error: "Invalid template ID" });
      return;
    }

    const lang = "eng";
    const uom: "SI" | "USC" = "SI";

    const result = await getTemplateDetailsById(templateId, lang, uom);
    if (!result) {
      console.warn(`⚠️ Template not found with ID: ${templateId}`);
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ getTemplateDetailForEdit error:", error);
    res.status(500).json({ error: "Failed to fetch template details" });
  }
};

export const getTemplateDetails: RequestHandler = async (req, res) => {
  try {
    const sheetId = parseInt(req.params.id, 10);
    if (isNaN(sheetId)) {
      res.status(400).json({ error: "Invalid template ID" });
      return;
    }

    const lang = String(req.query.lang || "eng");
    const uom = req.query.uom === "USC" ? "USC" : "SI";

    const result = await getTemplateDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).json({ error: "Template not found" });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ getTemplateDetails error:", error);
    res.status(500).json({ error: "Failed to fetch translated template details" });
  }
};

export const verifyTemplateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sheetId, action, rejectionComment } = req.body;
    const userId = (req.user as { userId: number }).userId;

    if (!sheetId || !["verify", "reject"].includes(action)) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }

    await verifyTemplate(sheetId, action, rejectionComment, userId);

    res.status(200).json({ message: "Template status updated successfully" });
  } catch (err) {
    console.error("❌ Failed to verify/reject template:", err);
    res.status(500).json({ error: "Server error during verification" });
  }
};

export const approveTemplateHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheetId = Number(req.params.id);
    const approverId = (req.user as { userId: number }).userId;
    const result = await approveTemplate(sheetId, approverId);
    res.status(200).json({ sheetId: result });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("❌ approveTemplateHandler error:", error.message);
    } else {
      console.error("❌ approveTemplateHandler error:", error);
    }
    res.status(500).json({ error: "Failed to approve template" });
  }
};

export const reviseTemplate = async (req: Request, res: Response) => {
  res.status(200).json({ message: "Revise Template - TODO" });
};

export const deleteTemplate = async (req: Request, res: Response) => {
  res.status(200).json({ message: "Delete Template - TODO" });
};

export const exportTemplatePDF: RequestHandler = async (req, res) => {
  try {
    const sheetId = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(sheetId) || sheetId <= 0) {
      res.status(400).send("Invalid sheet id.");
      return;
    }

    const lang = String(req.query.lang || "eng");
    const uom = (String(req.query.uom || "SI").toUpperCase() as "SI" | "USC");

    const result = await getTemplateDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).send("Template not found.");
      return;
    }

    const { datasheet } = result;

    // Load notes + attachments
    const [notes, attachmentsRaw] = await Promise.all([
      getSheetNotes(sheetId),
      getAttachmentsBySheet(sheetId), // may return DBAttachmentRow[] or AttachmentDTO[]
    ]);

    // Normalize to AttachmentDTO[]
    const attachments: AttachmentDTO[] = (attachmentsRaw as unknown[]).map((r) => {
      if (isAttachmentDTO(r)) return r;
      if (isDBAttachmentRow(r)) return mapDbRowToDTO(r, sheetId);
      throw new Error("Unexpected attachment row shape");
    });

    // Generate PDF with notes + attachments included
    const { buffer, fileName } = await generateDatasheetPDF(datasheet, lang, uom, {
      notes,
      attachments,
      allowNetworkFetch: true,           // if your PDF html fetches thumbnails from your backend
      authCookie: req.headers.cookie ?? "",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );
    res.send(buffer);
  } catch (err) {
    console.error("❌ Error exporting template PDF:", err);
    res.status(500).send("Failed to generate PDF.");
  }
};

export const exportTemplateExcel: RequestHandler = async (req, res) => {
  try {
    const sheetId = Number.parseInt(req.params.id, 10);
    const lang = String(req.query.lang || "eng");
    const uom = (String(req.query.uom || "SI").toUpperCase() as "SI" | "USC");

    const result = await getTemplateDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).send("Template not found.");
      return;
    }
    const { datasheet } = result;

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

    const clean = (s: string | number | null | undefined) =>
      String(s ?? "").replace(/[\/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
    const fileName = `Template-${clean(datasheet.clientName)}-${clean(
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
    console.error("❌ Error exporting template Excel:", error);
    res.status(500).send("Failed to generate Excel.");
  }
};

export const duplicateTemplate: RequestHandler = async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id, 10);
    const userId = getUserId(req);
    const linkPolicy = (req.query.linkPolicy as LinkPolicy) ?? "link";

    const newSheetId = await duplicateSheet({
      sourceId,
      userId,
      isTemplate: true,
      linkPolicy,
    });

    res.status(201).json({ newSheetId });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "Failed to duplicate template";
    const code = err instanceof HttpError ? err.status : 500;
    res.status(code).json({ error: msg });
  }
};

export const createTemplateRevision: RequestHandler = async (req, res) => {
  try {
    const sourceId = parseInt(req.params.id, 10);
    const userId = getUserId(req);
    const linkPolicy = (req.query.linkPolicy as LinkPolicy) ?? "link";

    const newSheetId = await createRevision({
      sourceId,
      userId,
      isTemplate: true,
      linkPolicy,
    });

    res.status(201).json({ newSheetId });
  } catch (err) {
    const msg = err instanceof HttpError ? err.message : "Failed to create template revision";
    const code = err instanceof HttpError ? err.status : 500;
    res.status(code).json({ error: msg });
  }
};

export const getAllTemplates = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT 
        s.SheetID AS sheetId,
        s.SheetName AS sheetName,
        s.SheetDesc AS sheetDesc,
        s.CategoryID AS categoryId,
        c.CategoryName AS categoryName,
        s.PreparedByID AS preparedById,
        u.FirstName + ' ' + u.LastName AS preparedByName,
        s.RevisionDate AS revisionDate, 
        s.Status AS status 
      FROM Sheets s
      LEFT JOIN Categories c ON s.CategoryID = c.CategoryID
      LEFT JOIN Users u ON s.PreparedByID = u.UserID
      WHERE s.IsTemplate = 1
      ORDER BY s.SheetID DESC
    `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to fetch templates:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTemplateReferenceOptions = async (req: Request, res: Response) => {
  try {
    const pool = await poolPromise;

    const categoriesResult = await pool.query(`SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName`);
    const usersResult = await pool.query(`SELECT UserID, FirstName, LastName FROM Users ORDER BY FirstName, LastName`);

    res.status(200).json({
      categories: categoriesResult.recordset,
      users: usersResult.recordset,
    });
  } catch (err) {
    console.error("❌ Failed to fetch reference options:", err);
    res.status(500).json({ error: "Failed to fetch reference options" });
  }
};
// src/backend/controllers/templateController.ts

import { Request, Response, RequestHandler } from "express";
import { poolPromise } from "../config/db";
import { unifiedSheetSchema } from "@/validation/sheetSchema";
import { createTemplate, updateTemplate, verifyTemplate, approveTemplate } from "../services/templateService";
import { getTemplateDetailsById } from "../services/templateService";
import { generateDatasheetPDF } from "@/utils/generateDatasheetPDF";
import { generateDatasheetExcel } from "@/utils/generateDatasheetExcel";

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
    const sheetId = parseInt(req.params.id);
    const lang = (req.query.lang as string) || "eng";
    const uom = (req.query.uom as string as "SI" | "USC") || "SI";

    const result = await getTemplateDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).send("Template not found.");
      return;
    }

    const { datasheet } = result;
    const { buffer, fileName } = await generateDatasheetPDF(datasheet, lang, uom);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error exporting template PDF:", error);
    res.status(500).send("Failed to generate PDF.");
  }
};

export const exportTemplateExcel: RequestHandler = async (req, res) => {
  try {
    const sheetId = parseInt(req.params.id);
    const lang = (req.query.lang as string) || "eng";
    const uom = (req.query.uom as string as "SI" | "USC") || "SI";

    const result = await getTemplateDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).send("Template not found.");
      return;
    }

    const { datasheet } = result;
    const buffer = await generateDatasheetExcel(datasheet, lang, uom);

    // Utility to sanitize filename segments
    const clean = (s: string | number | null | undefined) =>
      String(s ?? "")
        .replace(/[\/\\?%*:|"<>]/g, "")
        .trim()
        .replace(/\s+/g, "_");

    const fileName = `Template-${clean(datasheet.clientName)}-${clean(datasheet.sheetName)}-RevNo-${clean(datasheet.revisionNum)}-${uom}-${lang}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error exporting template Excel:", error);
    res.status(500).send("Failed to generate Excel.");
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
// src/backend/controllers/filledSheetController.ts
import { Request, Response } from "express";
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
  approveFilledSheet
} from "../services/filledSheetService";
import { generateDatasheetPDF } from "@/utils/generateDatasheetPDF";
import { generateDatasheetExcel } from "@/utils/generateDatasheetExcel";

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
    const sheetId = parseInt(req.params.id);
    const lang = String(req.query.lang || "eng");
    const uom = String(req.query.uom || "SI") as "SI" | "USC";

    const result = await getFilledSheetDetailsById(sheetId, lang, uom); // ✅ Pass all 3 arguments
    if (!result) {
      res.status(404).send("Sheet not found.");
      return;
    }

    const { datasheet } = result;
    const { buffer, fileName } = await generateDatasheetPDF(datasheet, lang, uom);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error exporting filled sheet PDF:", error);
    res.status(500).send("Failed to generate PDF.");
  }
};

// ✅ Excel export handler
export const exportFilledSheetExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const sheetId = parseInt(req.params.id);
    const lang = String(req.query.lang || "eng");
    const uom = String(req.query.uom || "SI") as "SI" | "USC";

    const result = await getFilledSheetDetailsById(sheetId, lang, uom);
    if (!result) {
      res.status(404).send("Sheet not found.");
      return;
    }

    const { datasheet } = result;
    const buffer = await generateDatasheetExcel(datasheet, lang, uom);

    // Generate a clean and meaningful file name
    const clean = (s: string | number | null | undefined) =>
      String(s ?? "")
        .replace(/[\/\\?%*:|"<>]/g, "")
        .trim()
        .replace(/\s+/g, "_");

    const sheetType = datasheet.isTemplate ? "Template" : "FilledSheet";
    const fileName = `${clean(sheetType)}-${clean(datasheet.clientName)}-${clean(datasheet.sheetName)}-RevNo-${clean(datasheet.revisionNum)}-${uom}-${lang}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
    res.send(buffer);
  } catch (error) {
    console.error("❌ Error exporting filled sheet Excel:", error);
    res.status(500).send("Failed to generate Excel.");
  }
};
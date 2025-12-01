// src/backend/controllers/layoutController.ts
import type { RequestHandler } from "express";
import { poolPromise } from "../config/db";
import * as svc from "@/backend/services/layoutService";
import type { PaperSize, Orientation, LayoutBundle, UomSystem, LangCode } from "@/domain/layouts/layoutTypes";

type BodySlotRow = Readonly<{
  slotIndex: number;
  subsheetId: number;
  columnNumber: 1 | 2;
  rowNumber: number; 
  width: 1 | 2;
}>;

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function toOneTwo(v: unknown): 1 | 2 | null {
  const n = Number(v);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return null;
}

function parseStringParam(input: unknown): string | undefined {
  if (typeof input === "string") return input;
  if (Array.isArray(input) && input.length > 0 && typeof input[0] === "string") return input[0];
  return undefined;
}
function parseNumberParam(input: unknown): number | undefined {
  const s = parseStringParam(input);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
function parseUomParam(input: unknown): UomSystem | undefined {
  const s = parseStringParam(input);
  if (!s) return undefined;
  const up = s.toUpperCase();
  return up === "SI" || up === "USC" ? (up as UomSystem) : undefined;
}
function parseLangParam(input: unknown): LangCode | undefined {
  const s = parseStringParam(input);
  return s === "en" ? "en" : undefined; // extend later if you add locales
}

function parseSlotRow(o: Record<string, unknown>): BodySlotRow | { error: string } {
  const slotIndex = toInt(o.slotIndex);
  if (slotIndex === null || slotIndex < 0) return { error: "Invalid slotIndex" };

  const subsheetId = toInt(o.subsheetId);
  if (subsheetId === null || subsheetId <= 0) return { error: "Invalid subsheetId" };

  const columnNumber = toOneTwo(o.columnNumber);
  if (columnNumber === null) return { error: "Invalid columnNumber" };

  const rowNumber = toInt(o.rowNumber);
  if (rowNumber === null || rowNumber <= 0) return { error: "Invalid rowNumber" };

  const width = toOneTwo(o.width);
  if (width === null) return { error: "Invalid width" };

  return { slotIndex, subsheetId, columnNumber, rowNumber, width };
}

export const listLayouts: RequestHandler = async (req, res) => {
  const templateId = req.query.templateId ? Number(req.query.templateId) : null;
  const clientId = req.query.clientId ? Number(req.query.clientId) : null;
  const rows = await svc.listLayouts({ templateId, clientId });
  res.json(rows);
};

export const getSubsheetInfoTemplates: RequestHandler = async (req, res) => {
  const subId = Number(req.params.subId);
  if (!Number.isFinite(subId) || subId <= 0) {
    return res.status(400).json({ error: "Invalid subId" });
  }

  try {
    const db = await poolPromise; 
    const templates = await svc.listInfoTemplatesBySubId(db, subId);
    return res.json({ templates });
  } catch (error) {
    let message = "Unknown error";
    if (error instanceof Error) message = error.message;
    else if (typeof error === "string") message = error;

    console.error(`[getSubsheetInfoTemplates] subId=${subId} failed: ${message}`, error);
    return res.status(500).json({ error: "Failed to load info templates" });
  }
};

export const createLayout: RequestHandler = async (req, res) => {
  const {
    templateId = null,
    clientId = null,
    paperSize = "A4",
    orientation = "portrait",
  }: { templateId?: number | null; clientId?: number | null; paperSize?: PaperSize; orientation?: Orientation } = req.body ?? {};
  const id = await svc.createLayout({ templateId, clientId, paperSize, orientation });
  res.status(201).json({ layoutId: id });
};

export const getLayout: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  const bundle: LayoutBundle | null = await svc.getLayoutBundle(layoutId);
  if (!bundle) return res.status(404).json({ error: "Layout not found" });
  res.json(bundle);
};

export const getLayoutStructure: RequestHandler = async (req, res) => {
  const layoutIdNum = Number(req.params.layoutId);
  if (!Number.isFinite(layoutIdNum) || layoutIdNum <= 0) {
    return res.status(400).json({ error: "Invalid layoutId" });
  }
  try {
    const data = await svc.getLayoutTemplateStructure(layoutIdNum);
    return res.json(data);
  } catch (err) {
    console.error("Failed to load layout template structure:", err);
    return res.status(500).json({ error: "Failed to load layout template structure" });
  }
};

export const updateLayoutMeta: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  await svc.updateLayoutMeta(layoutId, req.body);
  res.json({ ok: true });
};

export const addRegion: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  const regionId = await svc.addRegion(layoutId, req.body);
  res.status(201).json({ regionId });
};

export const updateRegion: RequestHandler = async (req, res) => {
  const regionId = Number(req.params.regionId);
  await svc.updateRegion(regionId, req.body);
  res.json({ ok: true });
};

export const addBlock: RequestHandler = async (req, res) => {
  const regionId = Number(req.params.regionId);
  const blockId = await svc.addBlock(regionId, req.body);
  res.status(201).json({ blockId });
};

export const updateBlock: RequestHandler = async (req, res) => {
  const blockId = Number(req.params.blockId);
  await svc.updateBlock(blockId, req.body);
  res.json({ ok: true });
};

export const saveSubsheetSlots: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  const subId = Number(req.params.subId);
  if (!Number.isFinite(layoutId) || !Number.isFinite(subId)) {
    return res.status(400).json({ error: "Invalid layoutId or subId" });
  }

  const body = req.body as {
    merged?: boolean;
    left?: Array<{ column: "left"; index: number; infoTemplateId: number }>;
    right?: Array<{ column: "right"; index: number; infoTemplateId: number }>;
  };

  try {
    const db = await poolPromise;
    await svc.saveSubsheetSlots(db, layoutId, subId, body);
    return res.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
};

export const saveLayoutBodySlots: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  if (!Number.isFinite(layoutId) || layoutId <= 0) {
    return res.status(400).json({ error: "Invalid layoutId" });
  }

  const slotsUnknown = (req.body?.slots ?? []) as unknown;
  if (!Array.isArray(slotsUnknown)) {
    return res.status(400).json({ error: "Payload must include slots: []" });
  }

  const normalized: BodySlotRow[] = [];
  for (const raw of slotsUnknown) {
    if (!raw || typeof raw !== "object") {
      return res.status(400).json({ error: "Each slot must be an object" });
    }
    const parsed = parseSlotRow(raw as Record<string, unknown>); // your helper
    if ("error" in parsed) {
      return res.status(400).json({ error: parsed.error });
    }
    normalized.push(parsed);
  }

  // ✅ Pre-validate: unique slotIndex
  {
    const seen = new Set<number>();
    for (const s of normalized) {
      if (seen.has(s.slotIndex)) {
        return res.status(400).json({ error: `Duplicate slotIndex ${s.slotIndex}` });
      }
      seen.add(s.slotIndex);
    }
  }

  try {
    // Helpful trace (feel free to remove later)
    if (process.env.NODE_ENV !== "production") {
      console.debug("[saveLayoutBodySlots] layoutId:", layoutId, "rows:", normalized.length);
    }

    await svc.saveLayoutBodySlots(layoutId, normalized);
    return res.json({ ok: true, count: normalized.length });
  } catch (e: unknown) {
    // ⛑️ Log useful SQL error info to server logs
    const err = e as { message?: string; stack?: string; originalError?: { info?: unknown } };
    console.error("saveLayoutBodySlots failed:", {
      message: err?.message,
      info: err?.originalError?.info,
      stack: err?.stack,
      layoutId,
      rows: normalized,
    });
    return res.status(500).json({ error: "Failed to save layout body slots" });
  }
};

export const getLayoutBodySlots: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  if (!Number.isFinite(layoutId) || layoutId <= 0) {
    return res.status(400).json({ error: "Invalid layoutId" });
  }
  try {
    const rows = await svc.listLayoutBodySlots(layoutId);
    return res.json({ slots: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return res.status(500).json({ error: msg });
  }
};

export const renderLayout: RequestHandler = async (req, res) => {
  // params (narrow to number or return early)
  const layoutIdMaybe = parseNumberParam(req.params?.layoutId);
  if (layoutIdMaybe === undefined) {
    return res.status(400).json({ error: "layoutId (param) is required and must be a number" });
  }
  const layoutId: number = layoutIdMaybe; // now narrowed

  // query (narrow to number or return early)
  const sheetIdMaybe = parseNumberParam(req.query?.sheetId);
  if (sheetIdMaybe === undefined) {
    return res.status(400).json({ error: "sheetId (query) is required and must be a number" });
  }
  const sheetId: number = sheetIdMaybe; // now narrowed

  // enums with safe defaults (no String(...) on unknowns)
  const uom: UomSystem = parseUomParam(req.query?.uom) ?? "SI";
  const lang: LangCode = parseLangParam(req.query?.lang) ?? "en";

  if (uom !== "SI" && uom !== "USC") {
    return res.status(400).json({ error: "uom must be SI or USC" });
  }
  if (lang !== "en") {
    return res.status(400).json({ error: "lang currently supports 'en' only" });
  }

  try {
    const payload = await svc.renderLayout({ layoutId, sheetId, uom, lang });
    return res.json(payload);
  } catch (err) {
    console.error("renderLayout failed:", err);
    const isDev = process.env.NODE_ENV !== "production";
    const payload = isDev && err instanceof Error
      ? { error: "Failed to render layout", message: err.message }
      : { error: "Failed to render layout" };
    return res.status(500).json(payload);
  }
};

export const getStructure: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  if (!Number.isFinite(layoutId) || layoutId <= 0) {
    res.status(400).json({ error: "Invalid layoutId" });
    return;
  }
  try {
    const data = await svc.getLayoutStructureData(layoutId); // <-- renamed service
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load structure" });
  }
};

export const getSubsheetSlots: RequestHandler = async (req, res) => {
  const layoutId = Number(req.params.layoutId);
  const subId = Number(req.params.subId);
  if (!Number.isFinite(layoutId) || !Number.isFinite(subId)) {
    res.status(400).json({ error: "Invalid layoutId or subId" });
    return;
  }
  try {
    const cfg = await svc.getSubsheetSlotsConfig(layoutId, subId);
    res.json(cfg);
  } catch (err) {
    console.error("Failed to load subsheet slots:", err);
    res.status(500).json({ error: "Failed to load subsheet slots" });
  }
};
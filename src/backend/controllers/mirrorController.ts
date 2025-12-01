// src/backend/controllers/mirrorController.ts
import type { RequestHandler } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import { SheetDefinitionJSON, LangTag } from "@/domain/i18n/mirrorTypes";
import { excelLearn } from "@/backend/services/templates/excelExtractor";
import { classifyDraft } from "@/backend/services/templates/classifier";
import { computeFingerprint } from "@/backend/services/templates/fingerprints";
import { upsertMirrorTemplate, getMirrorTemplate } from "@/backend/services/mirror/mirrorRepo";
import { renderWorkbookFromDefinition } from "@/backend/services/renderers/xlsxRenderer";
import { TranslationService } from "@/backend/services/i18n/TranslationService";
import { NullProvider } from "@/backend/services/i18n/NullProvider";

// In-memory store for MVP (swap with DB later)
const MEMORY_DEFS = new Map<string, SheetDefinitionJSON>();

// ---- Controllers ----

export const learnExcel: RequestHandler = async (req, res) => {
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: "file required" });

  try {
    const learnOut = await excelLearn(file.path);
    const draft = classifyDraft(learnOut);
    draft.fingerprint = computeFingerprint(learnOut);
    await fs.unlink(file.path).catch(() => void 0);

    return res.json({
      draftDefinition: draft,
      detectedFields: learnOut.detectedLabels,
    });
  } catch (err) {
    console.error("[learnExcel]", err);
    try { if (file?.path) await fs.unlink(file.path); } catch { /* ignore */ }
    return res.status(500).json({
      error: "learn failed",
      detail: process.env.NODE_ENV === "development" ? (err as Error)?.message : undefined,
    });
  }
};

export const confirmDefinition: RequestHandler = async (req, res) => {
  const definition = req.body as SheetDefinitionJSON;
  if (!definition?.id) return res.status(400).json({ error: "definition.id required" });

  // Optional: quick de-dup of identical labels on same row (keeps leftmost)
  // comment out if you don't want this behavior yet
  const seenRowLabel = new Set<string>();
  definition.fields = definition.fields.filter((f) => {
    const key = `${f.label.toLowerCase()}@r${f.bbox[1]}`;
    if (seenRowLabel.has(key)) return false;
    seenRowLabel.add(key);
    return true;
  });

  // Cache in memory for speed
  MEMORY_DEFS.set(definition.id, definition);

  // Persist to DB for durability
  await upsertMirrorTemplate(definition);

  return res.json({ ok: true, id: definition.id });
};

export const applyDefinition: RequestHandler = async (req, res) => {
  const body = req.body as { id: string; values: Record<string, string | number | boolean | null> };
  if (!body?.id) return res.status(400).json({ error: "id required" });

  // Allow both undefined and null during lookup
  let def: SheetDefinitionJSON | null = MEMORY_DEFS.get(body.id) ?? null;

  if (!def) {
    def = await getMirrorTemplate(body.id); // returns SheetDefinitionJSON | null
    if (!def) return res.status(404).json({ error: "template not found" });
    MEMORY_DEFS.set(def.id, def); // warm cache
  }

  // Here def is narrowed to SheetDefinitionJSON
  const outPath = await renderWorkbookFromDefinition(def, body.values ?? {});
  const filename = path.basename(outPath);
  return res.json({
    ok: true,
    fileName: filename,
    downloadPath: `/api/mirror/templates/download/${filename}`,
  });
};

export const downloadGenerated: RequestHandler = async (req, res) => {
  const name = req.params.name;
  const full = path.join(process.cwd(), "tmp_outputs", name);
  res.download(full);
};

const svc = new TranslationService(new NullProvider());

export const translateAndSave: RequestHandler = async (req, res) => {
  const body = req.body as {
    sourceLang: LangTag;
    targets: LangTag[];
    items: Array<{ entity: "sheet" | "subsheet" | "infoTemplate"; id: number; label: string; value?: string }>;
  };

  if (!body?.sourceLang?.startsWith("fr")) return res.status(400).json({ error: "French source required" });
  if (!Array.isArray(body.targets) || body.targets.length === 0) return res.status(400).json({ error: "targets required" });
  if (!Array.isArray(body.items) || body.items.length === 0) return res.status(400).json({ error: "items required" });

  const results = await svc.translateAndSave({
    sourceLang: body.sourceLang,
    targets: body.targets,
    items: body.items,
  });
  res.json({ ok: true, results });
};

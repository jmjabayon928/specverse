// src/backend/services/templates/excelExtractor.ts
import ExcelJS, { Worksheet, CellValue } from "exceljs";

/** ----- Types ----- */
export interface LearnOut {
  workbookMeta: {
    sheetName: string;
    rowCount: number;
    columnCount: number;
    pageSize: { w: number; h: number }; // logical units for downstream layouting
  };
  mergedCells: Array<{ range: string; top: number; left: number; bottom: number; right: number }>;
  boldTitles: Array<{ text: string; row: number; col: number; address: string }>;
  labelValuePairs: Array<{ label: string; valueHint: string; row: number; colLabel: number; colValue: number }>;
  detectedLabels: Array<{ label: string; address: string }>;
}

/** ----- Public API ----- */
export async function excelLearn(filePath: string): Promise<LearnOut> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  // Use the first visible worksheet
  const ws = pickFirstVisibleWorksheet(wb);
  const sheetName = ws.name;

  const rowCount = ws.actualRowCount || ws.rowCount || 0;
  const columnCount = ws.actualColumnCount || ws.columnCount || 0;

  const mergedCells = safeMergedRanges(ws);
  const boldTitles = extractBoldTitles(ws);
  const { labelValuePairs, detectedLabels } = extractLabelValuePairs(ws);

  return {
    workbookMeta: {
      sheetName,
      rowCount,
      columnCount,
      // Keep simple logical page size; renderer can scale as needed
      pageSize: { w: 1000, h: 1400 },
    },
    mergedCells,
    boldTitles,
    labelValuePairs,
    detectedLabels,
  };
}

/** ----- Helpers ----- */

/**
 * Pick the first visible worksheet (fallback to first if all are hidden).
 */
function pickFirstVisibleWorksheet(wb: ExcelJS.Workbook): Worksheet {
  const visible = wb.worksheets.find((w) => w.state !== "veryHidden" && w.state !== "hidden");
  return visible ?? wb.worksheets[0];
}

function isTextObj(v: unknown): v is { text: string } {
  return typeof v === "object" && v !== null && "text" in v && typeof (v as { text: unknown }).text === "string";
}
function isRichTextObj(v: unknown): v is { richText: Array<{ text: string }> } {
  return typeof v === "object" && v !== null && "richText" in v && Array.isArray((v as { richText: unknown }).richText);
}
function hasResult(v: unknown): v is { result: unknown } {
  return typeof v === "object" && v !== null && "result" in v;
}

// ---- Object-only parser (keeps cellText simple) ----
function objectCellText(obj: object): string | null {
  if (obj instanceof Date) return obj.toISOString();
  if (isTextObj(obj)) return obj.text;
  if (isRichTextObj(obj)) return obj.richText.map(p => p.text).join("");
  if (hasResult(obj)) {
    const r = obj.result;
    if (typeof r === "string") return r;
    if (typeof r === "number") return String(r);
    if (typeof r === "boolean") return r ? "true" : "false";
  }
  return null;
}

// ---- Low-complexity cellText ----
function cellText(cellValue: CellValue): string {
  if (cellValue == null) return "";

  if (typeof cellValue === "string") return cellValue;
  if (typeof cellValue === "number") return String(cellValue);
  if (typeof cellValue === "boolean") return cellValue ? "true" : "false";

  if (typeof cellValue === "object") {
    const s = objectCellText(cellValue as object);
    return s ?? "";
  }

  return "";
}

/**
 * Extract bold titles (good for region anchors). We keep them lightweight and capped in length.
 */
function extractBoldTitles(ws: Worksheet): Array<{ text: string; row: number; col: number; address: string }> {
  const out: Array<{ text: string; row: number; col: number; address: string }> = [];
  const maxRow = ws.actualRowCount || ws.rowCount || 0;
  const maxCol = ws.actualColumnCount || ws.columnCount || 0;

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const cell = ws.getCell(r, c);
      const text = cellText(cell.value);
      if (!text) continue;
      const isBold = Boolean(cell.font?.bold);
      if (isBold && text.length <= 64) {
        out.push({ text, row: r, col: c, address: cell.address });
      }
    }
  }
  return out;
}

/**
 * Extract common label:value row patterns.
 * Heuristic:
 *  - Label cell ends with ":" (or "：").
 *  - The immediate right cell is non-empty → treated as value hint.
 */
const COLON_LABEL_RE = /[:：]\s*$/;

function isColonLabel(text: string): boolean {
  return !!text && COLON_LABEL_RE.test(text);
}
function cleanLabel(text: string): string {
  return text.replace(COLON_LABEL_RE, "").trim();
}
function rightText(ws: Worksheet, r: number, c: number, maxCol: number): string {
  if (c >= maxCol) return "";
  const next = ws.getCell(r, c + 1);
  return cellText(next.value).trim();
}

function tryCollectPair(
  ws: Worksheet,
  r: number,
  c: number,
  maxCol: number,
  pairs: LearnOut["labelValuePairs"],
  dedup: Map<string, { label: string; address: string }>
): void {
  const leftRaw = cellText(ws.getCell(r, c).value).trim();
  if (!isColonLabel(leftRaw)) return;

  const label = cleanLabel(leftRaw);
  if (!label) return;

  const value = rightText(ws, r, c, maxCol);
  if (!value) return;

  pairs.push({ label, valueHint: value, row: r, colLabel: c, colValue: c + 1 });

  // dedupe by label+address to preserve context
  const address = ws.getCell(r, c).address;
  const key = `${label}@@${address}`;
  if (!dedup.has(key)) dedup.set(key, { label, address });
}

// ---- Refactored function ----
function extractLabelValuePairs(ws: Worksheet): {
  labelValuePairs: LearnOut["labelValuePairs"];
  detectedLabels: LearnOut["detectedLabels"];
} {
  const pairs: LearnOut["labelValuePairs"] = [];
  const dedup = new Map<string, { label: string; address: string }>();

  const maxRow = ws.actualRowCount || ws.rowCount || 0;
  const maxCol = ws.actualColumnCount || ws.columnCount || 0;

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      tryCollectPair(ws, r, c, maxCol, pairs, dedup);
    }
  }

  return { labelValuePairs: pairs, detectedLabels: Array.from(dedup.values()) };
}

/**
 * Safely extract merged ranges without using private properties.
 * exceljs does not expose a public API to list merges, so we attempt to
 * read from known internal shapes in a guarded way. If unavailable, we
 * return an empty array (the rest of the pipeline doesn't require merges).
 */
type MergedRange = { range: string; top: number; left: number; bottom: number; right: number };
type MergeRect = { top: number; left: number; bottom: number; right: number };

function safeMergedRanges(ws: Worksheet): MergedRange[] {
  const byModel = readModelMerges(ws);
  if (byModel.length) return byModel;

  const byInternal = readInternalMerges(ws);
  if (byInternal.length) return byInternal;

  return inferMergedRanges(ws);
}

/* ----------------- helpers ----------------- */

function readModelMerges(ws: Worksheet): MergedRange[] {
  const model = (ws as unknown as { model?: { merges?: Record<string, MergeRect> } }).model;
  const merges = model?.merges; // optional chaining to satisfy linter
  if (!merges) return [];
  return Object.entries(merges).map(([range, rect]) => ({
    range,
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
  }));
}

function readInternalMerges(ws: Worksheet): MergedRange[] {
  const mm = (ws as unknown as { _merges?: Map<string, MergeRect> })._merges;
  if (!mm || typeof mm.forEach !== "function") return [];
  const out: MergedRange[] = [];
  mm.forEach((rect, key) => {
    out.push({ range: key, top: rect.top, left: rect.left, bottom: rect.bottom, right: rect.right });
  });
  return out;
}

function inferMergedRanges(ws: Worksheet): MergedRange[] {
  const inferred: MergedRange[] = [];
  const seen = new Set<string>();

  const maxRow = ws.actualRowCount || ws.rowCount || 0;
  const maxCol = ws.actualColumnCount || ws.columnCount || 0;

  for (let r = 1; r <= maxRow; r++) {
    for (let c = 1; c <= maxCol; c++) {
      const cell = ws.getCell(r, c);
      if (!cell.isMerged) continue;

      const master = findMergeMaster(ws, r, c);
      if (!master) continue;

      const { top, left, bottom, right } = master;
      const key = `${top}:${left}:${bottom}:${right}`;
      if (seen.has(key)) continue;
      seen.add(key);

      inferred.push({
        range: toA1Range(top, left, bottom, right),
        top,
        left,
        bottom,
        right,
      });
    }
  }

  return inferred;
}

function findMergeMaster(ws: Worksheet, row: number, col: number): { top: number; left: number; bottom: number; right: number } | null {
  // Walk up & left until not merged to approximate top-left
  let top = row;
  let left = col;
  while (top > 1 && ws.getCell(top - 1, left).isMerged) top--;
  while (left > 1 && ws.getCell(top, left - 1).isMerged) left--;

  // Walk down & right to find bottom-right
  let bottom = top;
  let right = left;
  const maxRow = ws.actualRowCount || ws.rowCount || 0;
  const maxCol = ws.actualColumnCount || ws.columnCount || 0;

  while (bottom + 1 <= maxRow && ws.getCell(bottom + 1, left).isMerged) bottom++;
  while (right + 1 <= maxCol && ws.getCell(top, right + 1).isMerged) right++;

  // Sanity check: ensure the rectangle is indeed merged
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (!ws.getCell(r, c).isMerged) return null;
    }
  }

  return { top, left, bottom, right };
}

/** Convert row/col bounds to an A1 range like A1:D4 (best-effort, columns up to ZZ). */
function toA1Range(top: number, left: number, bottom: number, right: number): string {
  return `${toA1Col(left)}${top}:${toA1Col(right)}${bottom}`;
}

function toA1Col(n: number): string {
  // 1 -> A, 26 -> Z, 27 -> AA
  let x = n;
  let out = "";
  while (x > 0) {
    const rem = (x - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    x = Math.floor((x - 1) / 26);
  }
  return out;
}

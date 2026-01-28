// src/backend/services/templates/fingerprints.ts
import { ExcelTemplateAnalysis } from "./excelExtractor";
import { SheetDefinitionJSON } from "@/domain/i18n/mirrorTypes";

type Fingerprint = SheetDefinitionJSON["fingerprint"];

const MAX_ANCHORS = 12;
const MAX_LABELS = 40;

export function computeFingerprint(learn: ExcelTemplateAnalysis): Fingerprint {
  const {
    workbookMeta: { pageSize, rowCount, columnCount },
    boldTitles,
    labelValuePairs,
  } = learn;

  const anchors = buildAnchors(boldTitles, MAX_ANCHORS);
  const gridHash = `r${rowCount}c${columnCount}`;
  const labelSet = buildLabelSet(labelValuePairs, MAX_LABELS);

  return {
    pageSize,
    anchors,
    gridHash,
    labelSet,
  };
}

/* -------------------- helpers -------------------- */

function buildAnchors(
  titles: Array<{ text: string; row: number; col: number }>,
  limit: number
): Array<{ text: string; bbox: [number, number, number, number] }> {
  // Normalize, de-dup by normalized text, keep top-most first, and cap.
  const norm = (s: string) => s.replaceAll(/\s+/g, " ").trim().toLowerCase();

  const seen = new Set<string>();
  const out: Array<{ text: string; bbox: [number, number, number, number] }> = [];

  for (const t of [...titles].sort((a, b) => a.row - b.row)) {
    const raw = sanitizeTitle(t.text);
    if (!raw) continue;

    const key = norm(raw);
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      text: raw,
      // 1x1 bbox around the anchor cell (col,row to col+1,row)
      bbox: [t.col, t.row, t.col + 1, t.row],
    });

    if (out.length >= limit) break;
  }

  return out;
}

function buildLabelSet(
  pairs: ExcelTemplateAnalysis["labelValuePairs"],
  limit: number
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const p of pairs) {
    const label = sanitizeTitle(p.label);
    if (!label) continue;

    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    result.push(label);
    if (result.length >= limit) break;
  }

  return result;
}

function sanitizeTitle(s: string): string {
  // Collapse whitespace and trim; keep short and readable
  const v = s.replaceAll(/\s+/g, " ").trim();
  return v.slice(0, 80);
}

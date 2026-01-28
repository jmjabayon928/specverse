// src/backend/services/templates/classifier.ts
import crypto from "node:crypto";
import { ExcelTemplateAnalysis } from "./excelExtractor";
import { SheetDefinitionJSON, FieldDef } from "@/domain/i18n/mirrorTypes";

/**
 * Classify a learned Excel layout into a draft SheetDefinitionJSON.
 * - Header rows: top band (min 3 rows, ~8% of sheet height).
 * - Equipment band: next ~8 rows or until first subsheet title.
 * - Subsheet regions: bold titles below the header become section anchors.
 * - Fields: from label:value pairs. Type inferred from value hint.
 */
export function classifyDraft(learn: ExcelTemplateAnalysis): SheetDefinitionJSON {
  const {
    workbookMeta: { sheetName, rowCount, columnCount, pageSize },
    boldTitles,
    labelValuePairs,
  } = learn;

  const headerRows = Math.max(3, Math.floor(rowCount * 0.08));
  const titleRowsSorted = [...boldTitles].sort((a, b) => a.row - b.row);

  // Subsheet anchors are bold titles below the header
  const subsheetAnchors = titleRowsSorted.filter((t) => t.row > headerRows);

  // Compute subsheet regions by spanning from each anchor down to the next anchor - 1
  const subsheets = computeSubsheetRegions(subsheetAnchors, rowCount, columnCount);

  // Equipment region: immediately after header, limited height (or before first subsheet)
  const firstSubsheetRow = subsheets.length > 0 ? subsheets[0].bbox[1] : rowCount;
  const equipmentTop = headerRows + 1;
  const equipmentBottom = Math.min(equipmentTop + 7, firstSubsheetRow - 1);
  const equipmentRegionBottom = Math.max(equipmentBottom, equipmentTop);

  // Build fields: map label/value hints to FieldDefs with simple type inference
  const fields: FieldDef[] = labelValuePairs.map((p, idx) => ({
    key: `f_${idx.toString().padStart(3, "0")}`,
    label: p.label,
    bbox: [p.colLabel, p.row, p.colValue, p.row],
    type: inferType(p.valueHint),
    mapTo: {
      bucket: "templateField",
    },
  }));

  // Draft definition (fingerprint is filled by computeFingerprint later)
  const def: SheetDefinitionJSON = {
    id: crypto.randomUUID(),
    clientKey: `${sheetName}-v1`,
    sourceKind: "xlsx",
    fingerprint: {
      pageSize,
      anchors: [],
      gridHash: `r${rowCount}c${columnCount}`,
      labelSet: Array.from(new Set(labelValuePairs.map((p) => p.label))).slice(0, 30),
    },
    regions: {
      header: {
        name: "HEADER",
        bbox: [1, 1, columnCount, headerRows],
      },
      equipment: {
        name: "EQUIPMENT",
        bbox: [1, equipmentTop, Math.max(2, Math.floor(columnCount / 2)), equipmentRegionBottom],
      },
      subsheets,
    },
    fields,
    renderHints: {
      font: "Calibri",
      baseLineHeight: 14,
      tableBorders: [],
      exactPlacement: false,
    },
  };

  return def;
}

/* ------------------------- helpers ------------------------- */

/**
 * Turn bold title anchors into subsheet region boxes.
 * Each region spans from the title row down to the row above the next title.
 */
function computeSubsheetRegions(
  anchors: Array<{ text: string; row: number; col: number }>,
  rowCount: number,
  columnCount: number
): Array<{ name: string; bbox: [number, number, number, number] }> {
  if (anchors.length === 0) return [];

  const regions: Array<{ name: string; bbox: [number, number, number, number] }> = [];
  for (let i = 0; i < anchors.length; i++) {
    const cur = anchors[i];
    const next = anchors[i + 1];
    const top = cur.row;
    const bottom = next ? Math.max(top, next.row - 1) : rowCount;
    regions.push({
      name: sanitizeTitle(cur.text),
      bbox: [1, top, columnCount, bottom],
    });
  }
  return regions;
}

function sanitizeTitle(s: string): string {
  // Keep it readable and short for region names
  return s.replaceAll(/\s+/g, " ").trim().slice(0, 80);
}

/**
 * Infer a basic field type from a value hint string.
 * This is conservative: prefer 'string' unless a strong signal is present.
 */
function inferType(valueHint: string): FieldDef["type"] {
  const v = valueHint.trim();

  // boolean style hints
  if (/^(yes|no|true|false)$/i.test(v)) return "bool";

  // date-ish (very loose)
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(v)) return "date";

  // number with optional unit (e.g., 12, 12.5, -3, 1000 rpm, 15 °C)
  // Cleaned character class: removed duplicate '.' and duplicate degree symbol.
  if (/^[+-]?\d+(?:[.,]\d+)?(?:\s*[A-Za-z%/.\u00B0-]+)?$/.test(v)) return "number";

  // simple enum pattern: short comma/ slash-separated tokens (CSA / ATEX / IECEx)
  if (/^[A-Za-z0-9]{2,10}(?:\s*[,/]\s*[A-Za-z0-9]{2,10}){1,6}$/.test(v)) return "enum";

  return "string";
}

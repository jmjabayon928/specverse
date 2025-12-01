// src/backend/services/renderers/xlsxRenderer.ts
import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs/promises";
import { SheetDefinitionJSON } from "@/domain/i18n/mirrorTypes";

export type ValueMap = Record<string, string | number | boolean | null>;

/**
 * Render a workbook from a learned definition and provided values.
 * Returns the absolute file path of the generated .xlsx.
 */
export async function renderWorkbookFromDefinition(
  def: SheetDefinitionJSON,
  values: ValueMap
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(safeSheetName(def.clientKey));

  // Basic page setup (harmless defaults)
  ws.properties.defaultColWidth = 18;

  // Optionally render region headings (lightweight)
  renderRegionTitles(ws, def);

  if (def.renderHints.exactPlacement) {
    placeFieldsByBBox(ws, def, values);
  } else {
    placeFieldsSequentially(ws, def, values);
  }

  const outDir = path.join(process.cwd(), "tmp_outputs");
  await fs.mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, `${def.clientKey}-${def.id}.xlsx`);
  await wb.xlsx.writeFile(outPath);
  return outPath;
}

/* ----------------------------- helpers ----------------------------- */

function safeSheetName(name: string): string {
  // Excel limits sheet names to 31 chars and forbids some characters
  const cleaned = name.replace(/[\\/*?:[\]]/g, " ").trim();
  return cleaned.length <= 31 ? cleaned : cleaned.slice(0, 31);
}

function toDisplay(val: string | number | boolean | null | undefined): string | number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean") {
    // Avoid ternary to satisfy linter
    if (val === true) return "Yes";
    return "No";
  }
  return val;
}

function setCellValue(ws: ExcelJS.Worksheet, row: number, col: number, value: string | number | null, bold = false) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  if (bold) cell.font = { ...(cell.font ?? {}), bold: true };
  // Basic alignment for readability
  cell.alignment = cell.alignment ?? { vertical: "middle" };
}

function renderRegionTitles(ws: ExcelJS.Worksheet, def: SheetDefinitionJSON) {
  // Header title at A1
  setCellValue(ws, 1, 1, def.clientKey, true);
  ws.getRow(1).height = 18;

  // Light labels for regions (won't interfere with fields)
  // Header box label
  const [hL, hT] = def.regions.header.bbox;
  setCellValue(ws, hT, hL, def.regions.header.name, true);

  // Equipment label
  const [eL, eT] = def.regions.equipment.bbox;
  setCellValue(ws, eT, eL, def.regions.equipment.name, true);

  // Subsheet labels
  for (const r of def.regions.subsheets) {
    const [sL, sT] = r.bbox;
    setCellValue(ws, sT, sL, r.name, true);
  }
}

/**
 * Exact placement mode: use bbox from fields.
 * Field.bbox = [colLabel, row, colValue, row]
 */
function placeFieldsByBBox(ws: ExcelJS.Worksheet, def: SheetDefinitionJSON, values: ValueMap) {
  // Track occupied cells to avoid accidental overwrite in odd layouts
  const occupied = new Set<string>();

  for (const f of def.fields) {
    const [colLabel, row, colValue] = f.bbox;
    const labelText = `${f.label}:`;
    const val = toDisplay(values[f.key]);

    writeIfFree(ws, row, colLabel, labelText, true, occupied);
    writeIfFree(ws, row, colValue, val, false, occupied);
  }
}

/**
 * Simple list mode: render fields one per row under a small header.
 */
function placeFieldsSequentially(ws: ExcelJS.Worksheet, def: SheetDefinitionJSON, values: ValueMap) {
  let row = 3;
  // simple two-column list: label in col 1, value in col 2
  ws.getColumn(1).width = 34;
  ws.getColumn(2).width = 28;

  for (const f of def.fields) {
    setCellValue(ws, row, 1, `${f.label}:`, true);
    setCellValue(ws, row, 2, toDisplay(values[f.key]));
    row++;
  }
}

/**
 * Write into a cell only if it's not already occupied; mark it as used.
 */
function writeIfFree(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: string | number | null | undefined,
  bold: boolean,
  occupied: Set<string>
) {
  if (value === undefined) return;
  const key = `${row}:${col}`;
  if (occupied.has(key)) return;
  setCellValue(ws, row, col, value ?? null, bold);
  occupied.add(key);
}

// src/backend/services/layoutService.ts
import { ConnectionPool, IResult, Int, Request } from "mssql";
import { poolPromise, sql } from "../config/db";
import type { 
  LayoutBundle, 
  LayoutMeta, 
  LayoutRegion, 
  LayoutBlock, 
  PaperSize, 
  Orientation,
  RenderPayload,
  RenderBlock,
  RenderField,
  UomSystem,
  LangCode,
} from "@/domain/layouts/layoutTypes";
import {
  getConvertedUOM,
  formatFieldValue,
  getTranslatedFieldLabel,
  primeTemplateLabelTranslations,
} from "@/backend/services/i18nUomHelpers";

type RenderArgs = { layoutId: number; sheetId: number; uom: UomSystem; lang: LangCode };
type BindFn = (req: Request) => void;
type SubsheetNameMap = Record<number, string>;

type SubsheetSlots = Readonly<{ left: number[]; right: number[]; merged: boolean }>;

interface SheetRow {
  EquipmentTagNum: string | null;
  EquipmentName: string | null;
  ProjectRef: string | null;
}
interface HeaderKVRow {
  FieldKey: string;
  FieldValue: string | null;
  UOM: string | null;
}
interface TemplateRow {
  InfoTemplateID: number;
  SubsheetID: number;
  Label: string;
  UOM: string | null;
}
type BodySlotRow = Readonly<{
  slotIndex: number;
  subsheetId: number;
  columnNumber: 1 | 2;
  rowNumber: number; 
  width: 1 | 2;
}>;

type BodySlotRowOut = Readonly<{
  slotIndex: number;
  subsheetId: number;
  columnNumber: 1 | 2 | null;
  rowNumber: number | null;
  width: 1 | 2;
}>;

export type SubsheetSlotsConfig = Readonly<{
  merged: boolean;
  left:  ReadonlyArray<{ index: number; infoTemplateId: number }>;
  right: ReadonlyArray<{ index: number; infoTemplateId: number }>;
}>;

type Row = Readonly<{
  InfoTemplateID: number;
  ColumnNumber: number | null;
  OrderInColumn: number;
}>;

export async function getSubsheetSlotsConfig(
  layoutId: number,
  subId: number
): Promise<SubsheetSlotsConfig> {
  const pool = await poolPromise;

  const result = await pool.request()
    .input("layoutId", sql.Int, layoutId)
    .input("subId", sql.Int, subId)
    .query<Row>(`
      SELECT InfoTemplateID, ColumnNumber, OrderInColumn
      FROM dbo.LayoutSubsheetSlots
      WHERE LayoutID = @layoutId AND SubsheetID = @subId
      ORDER BY ColumnNumber, OrderInColumn
    `);

  const rows: ReadonlyArray<Row> = result.recordset ?? [];

  if (rows.length === 0) {
    // no saved slots for this subsheet → let frontend fall back to merged view
    return { merged: true, left: [], right: [] };
  }

  const left  = rows
    .filter(r => (r.ColumnNumber ?? 1) === 1)
    .map(r => ({ index: r.OrderInColumn, infoTemplateId: r.InfoTemplateID }));

  const right = rows
    .filter(r => (r.ColumnNumber ?? 1) === 2)
    .map(r => ({ index: r.OrderInColumn, infoTemplateId: r.InfoTemplateID }));

  return { merged: false, left, right };
}

async function getSubsheetNameMap(ids: ReadonlyArray<number>): Promise<SubsheetNameMap> {
  const uniq: number[] = [];
  for (const v of ids) {
    if (typeof v === "number" && Number.isFinite(v) && !uniq.includes(v)) uniq.push(v);
  }
  if (uniq.length === 0) return {};

  const pool = await poolPromise;

  // Build named params: @p0, @p1, ...
  const placeholders: string[] = [];
  for (let i = 0; i < uniq.length; i++) placeholders.push(`@p${i}`);

  const q = `
    SELECT s.SubID, s.SubName
    FROM dbo.SubSheets AS s
    WHERE s.SubID IN (${placeholders.join(", ")})
  `;

  const req = pool.request();
  for (let i = 0; i < uniq.length; i++) req.input(`p${i}`, sql.Int, uniq[i]);

  const r = await req.query<{ SubID: number; SubName: string }>(q);

  const out: SubsheetNameMap = {};
  for (const row of r.recordset) {
    if (typeof row.SubID === "number" && typeof row.SubName === "string" && row.SubName.trim()) {
      out[row.SubID] = row.SubName.trim();
    }
  }
  return out;
}

function resolveSubsheetName(
  id: number,
  candidate?: string | null,
  map?: Record<number, string>
): string | null {
  const pick = (s?: string | null): string | null => {
    if (!s) return null;
    const t = s.trim();
    if (!t || /^\d+$/.test(t)) return null;
    return t;
  };
  return pick(candidate) ?? pick(map?.[id]) ?? null;
}

function toInt(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function normalizeColumnNumber(v: unknown): 1 | 2 | null {
  const n = Number(v);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return null;
}

function normalizeRowNumber(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function normalizeWidth(v: unknown): 1 | 2 {
  const n = Number(v);
  return n === 2 ? 2 : 1; // default safely to 1
}

async function queryOne<T>(
  pool: ConnectionPool,
  sqlText: string,
  bind?: BindFn
): Promise<T | null> {
  const req = pool.request();
  if (bind) bind(req);
  const result: IResult<T> = await req.query(sqlText);
  return result.recordset.length > 0 ? result.recordset[0] : null;
}

async function queryMany<T>(
  pool: ConnectionPool,
  sqlText: string,
  bind?: BindFn
): Promise<T[]> {
  const req = pool.request();
  if (bind) bind(req);
  const result: IResult<T> = await req.query(sqlText);
  return result.recordset;
}

/**
 * Builds a parameterized IN (...) clause.
 * Example: const { clause, bind } = inClause("sub", [68,69]);
 *          WHERE x IN (${clause})
 *          bind(req) // attaches @sub0,@sub1...
 */
function inClause(nameBase: string, values: number[]) {
  const paramNames: string[] = [];
  for (let i = 0; i < values.length; i += 1) {
    paramNames.push(`@${nameBase}${i}`);
  }
  const clause = paramNames.join(", ");
  const bind: BindFn = (req) => {
    let idx = 0;
    for (const v of values) {
      req.input(`${nameBase}${idx}`, Int, v);
      idx += 1;
    }
  };
  return { clause, bind };
}

export type InfoTemplateRow = Readonly<{
  InfoTemplateID: number;
  Label: string;
}>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// Replace your isInfoTemplateRow with this:
function isInfoTemplateRow(v: unknown): v is InfoTemplateRow {
  if (!isRecord(v)) return false;
  const id = v["InfoTemplateID"];
  const label = v["Label"];
  return typeof id === "number" && typeof label === "string";
}

export async function listInfoTemplatesBySubId(
  db: sql.ConnectionPool,
  subId: number
): Promise<InfoTemplateRow[]> {
  const result = await db
    .request()
    .input("subId", sql.Int, subId)
    .query(`
      SELECT
        it.InfoTemplateID,
        it.Label
      FROM dbo.InformationTemplates AS it
      WHERE it.SubID = @subId
      ORDER BY
        CASE 
          WHEN COLUMNPROPERTY(OBJECT_ID('dbo.InformationTemplates'), 'OrderIndex', 'ColumnId') IS NULL 
          THEN 0 ELSE 1 
        END DESC,
        it.OrderIndex,
        it.InfoTemplateID
    `);

  const rows = (result.recordset ?? []) as Array<unknown>;

  // Type-safe normalize
  return rows
    .filter(isInfoTemplateRow)
    .map(r => ({ InfoTemplateID: r.InfoTemplateID, Label: r.Label }));
}

export async function listLayouts(filter: { templateId: number | null; clientId: number | null }) {
  const pool = await poolPromise;
  const req = pool.request();
  if (filter.templateId !== null) req.input("TemplateID", sql.Int, filter.templateId);
  if (filter.clientId !== null)   req.input("ClientID", sql.Int,   filter.clientId);

  const where: string[] = [];
  if (filter.templateId !== null) where.push("TemplateID = @TemplateID");
  if (filter.clientId !== null)   where.push("ClientID = @ClientID");

  const result = await req.query<{
    LayoutID: number; TemplateID: number | null; ClientID: number | null; PaperSize: string;
    Orientation: string; GridCols: number; GridGapMm: number; MarginTopMm: number; MarginRightMm: number;
    MarginBottomMm: number; MarginLeftMm: number; Version: number; IsDefault: boolean;
  }>(`
    SELECT LayoutID, TemplateID, ClientID, PaperSize, Orientation, GridCols, GridGapMm,
           MarginTopMm, MarginRightMm, MarginBottomMm, MarginLeftMm, Version, IsDefault
    FROM dbo.DatasheetLayouts
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY LayoutID DESC
  `);
  return result.recordset;
}

export async function getLayoutTemplateStructure(layoutId: number): Promise<{
  subsheets: Array<{ id: number; name: string }>;
  fields: Array<{ id: number; label: string; subId: number | null }>;
}> {
  const pool = await poolPromise;

  // 1) Resolve TemplateID (which is a SheetID)
  const tmpl = await pool
    .request()
    .input("LayoutID", sql.Int, layoutId)
    .query(`
      SELECT TemplateID
      FROM DatasheetLayouts
      WHERE LayoutID = @LayoutID
    `);

  const templateId = Number(tmpl.recordset?.[0]?.TemplateID ?? 0);
  if (!Number.isFinite(templateId) || templateId <= 0) {
    return { subsheets: [], fields: [] };
  }

  // 2) Subsheets for that SheetID (bind @SheetID on a NEW request)
  const subsRs = await pool
    .request()
    .input("SheetID", sql.Int, templateId)
    .query(`
      SELECT s.SubID AS id, s.SubName AS name
      FROM SubSheets s
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex, s.SubID
    `);

  const subsheets = (subsRs.recordset ?? []).map((r) => ({
    id: Number(r.id),
    name: String(r.name ?? `Subsheet ${r.id}`),
  }));

  // 3) Fields for those subsheets
  const fldRs = await pool
    .request()
    .input("SheetID", sql.Int, templateId)
    .query(`
      SELECT it.InfoTemplateID AS id,
             it.Label          AS label,
             it.SubID          AS subId,
             it.OrderIndex     AS orderIndex
      FROM InformationTemplates it
      INNER JOIN SubSheets s ON s.SubID = it.SubID
      WHERE s.SheetID = @SheetID
      ORDER BY
        it.SubID,
        CASE WHEN it.OrderIndex IS NULL THEN 2147483647 ELSE it.OrderIndex END,
        it.InfoTemplateID
    `);

  const rawFields = fldRs.recordset ?? [];
  const fields = rawFields.map((r) => ({
    id: Number(r.id),
    label: String(r.label ?? `Field ${r.id}`),
    subId: Number.isFinite(Number(r.subId)) ? Number(r.subId) : null,
  }));

  return { subsheets, fields };
}

export async function createLayout(args: {
  templateId: number | null; clientId: number | null; paperSize: PaperSize; orientation: Orientation;
}) {
  const pool = await poolPromise;
  const r = await pool.request()
    .input("TemplateID", sql.Int, args.templateId)
    .input("ClientID", sql.Int, args.clientId)
    .input("PaperSize", sql.NVarChar(16), args.paperSize)
    .input("Orientation", sql.NVarChar(16), args.orientation)
    .query(`
      INSERT INTO dbo.DatasheetLayouts (TemplateID, ClientID, PaperSize, Orientation)
      VALUES (@TemplateID, @ClientID, @PaperSize, @Orientation);
      SELECT SCOPE_IDENTITY() AS id;
    `);
  const id = Number(r.recordset[0].id);
  // Seed with three regions (header/body/footer)
  await pool.request().input("LayoutID", sql.Int, id).query(`
    INSERT INTO dbo.LayoutRegions (LayoutID, Kind, Name, X, Y, W, H, OrderIndex)
    VALUES
      (@LayoutID, 'locked','Header',0,0,24,2,0),
      (@LayoutID, 'dynamic','Body',0,2,24,28,1),
      (@LayoutID, 'locked','Footer',0,30,24,2,2);
  `);
  return id;
}

export async function getLayoutBundle(layoutId: number): Promise<LayoutBundle | null> {
  const pool = await poolPromise;
  const metaQ = await pool.request().input("LayoutID", sql.Int, layoutId).query(`
    SELECT TOP 1 *
    FROM dbo.DatasheetLayouts WHERE LayoutID = @LayoutID
  `);
  if (metaQ.recordset.length === 0) return null;

  const metaRow = metaQ.recordset[0];
  const meta: LayoutMeta = {
    layoutId,
    templateId: metaRow.TemplateID ?? null,
    clientId: metaRow.ClientID ?? null,
    paperSize: metaRow.PaperSize,
    orientation: metaRow.Orientation,
    gridCols: metaRow.GridCols,
    gridGapMm: Number(metaRow.GridGapMm),
    marginsMm: {
      top: Number(metaRow.MarginTopMm),
      right: Number(metaRow.MarginRightMm),
      bottom: Number(metaRow.MarginBottomMm),
      left: Number(metaRow.MarginLeftMm),
    },
    theme: metaRow.ThemeJSON ? JSON.parse(metaRow.ThemeJSON) : null,
    lockedHeader: metaRow.LockedHeaderJSON ? JSON.parse(metaRow.LockedHeaderJSON) : null,
    lockedFooter: metaRow.LockedFooterJSON ? JSON.parse(metaRow.LockedFooterJSON) : null,
    version: metaRow.Version,
    isDefault: Boolean(metaRow.IsDefault),
  };

  const regionsQ = await pool.request().input("LayoutID", sql.Int, layoutId).query(`
    SELECT * FROM dbo.LayoutRegions WHERE LayoutID=@LayoutID ORDER BY OrderIndex, RegionID
  `);
  const regions: LayoutRegion[] = regionsQ.recordset.map((r) => ({
    regionId: r.RegionID, layoutId, kind: r.Kind, name: r.Name,
    x: r.X, y: r.Y, w: r.W, h: r.H,
    style: r.StyleJSON ? JSON.parse(r.StyleJSON) : null,
    orderIndex: r.OrderIndex
  }));

  const blocksQ = await pool.request().input("LayoutID", sql.Int, layoutId).query(`
    SELECT b.*
    FROM dbo.LayoutBlocks b
    INNER JOIN dbo.LayoutRegions r ON r.RegionID = b.RegionID
    WHERE r.LayoutID=@LayoutID
    ORDER BY b.OrderIndex, b.BlockID
  `);
  const blocks: LayoutBlock[] = blocksQ.recordset.map((b) => ({
    blockId: b.BlockID, regionId: b.RegionID, blockType: b.BlockType,
    sourceRef: b.SourceRef ? JSON.parse(b.SourceRef) : null,
    props: b.PropsJSON ? JSON.parse(b.PropsJSON) : null,
    x: b.X, y: b.Y, w: b.W, h: b.H, orderIndex: b.OrderIndex
  }));

  return { meta, regions, blocks };
}

export async function updateLayoutMeta(layoutId: number, body: Partial<LayoutMeta>) {
  const pool = await poolPromise;
  const req = pool.request().input("LayoutID", sql.Int, layoutId);

  const sets: string[] = [];
  if (body.paperSize)      { req.input("PaperSize", sql.NVarChar(16), body.paperSize); sets.push("PaperSize=@PaperSize"); }
  if (body.orientation)    { req.input("Orientation", sql.NVarChar(16), body.orientation); sets.push("Orientation=@Orientation"); }
  if (body.gridCols !== undefined) { req.input("GridCols", sql.Int, body.gridCols); sets.push("GridCols=@GridCols"); }
  if (body.gridGapMm !== undefined){ req.input("GridGapMm", sql.Decimal(9,2), body.gridGapMm); sets.push("GridGapMm=@GridGapMm"); }
  if (body.marginsMm) {
    req.input("MarginTopMm", sql.Decimal(9,2), body.marginsMm.top);
    req.input("MarginRightMm", sql.Decimal(9,2), body.marginsMm.right);
    req.input("MarginBottomMm", sql.Decimal(9,2), body.marginsMm.bottom);
    req.input("MarginLeftMm", sql.Decimal(9,2), body.marginsMm.left);
    sets.push("MarginTopMm=@MarginTopMm","MarginRightMm=@MarginRightMm","MarginBottomMm=@MarginBottomMm","MarginLeftMm=@MarginLeftMm");
  }
  if (body.theme !== undefined)        { req.input("ThemeJSON", sql.NVarChar(sql.MAX), body.theme ? JSON.stringify(body.theme) : null); sets.push("ThemeJSON=@ThemeJSON"); }
  if (body.lockedHeader !== undefined) { req.input("LockedHeaderJSON", sql.NVarChar(sql.MAX), body.lockedHeader ? JSON.stringify(body.lockedHeader) : null); sets.push("LockedHeaderJSON=@LockedHeaderJSON"); }
  if (body.lockedFooter !== undefined) { req.input("LockedFooterJSON", sql.NVarChar(sql.MAX), body.lockedFooter ? JSON.stringify(body.lockedFooter) : null); sets.push("LockedFooterJSON=@LockedFooterJSON"); }

  if (sets.length === 0) return;
  await req.query(`UPDATE dbo.DatasheetLayouts SET ${sets.join(", ")}, UpdatedAt=SYSUTCDATETIME() WHERE LayoutID=@LayoutID`);
}

export async function addRegion(layoutId: number, body: Partial<LayoutRegion>): Promise<number> {
  const pool = await poolPromise;
  const r = await pool.request()
    .input("LayoutID", sql.Int, layoutId)
    .input("Kind", sql.NVarChar(16), body.kind ?? "dynamic")
    .input("Name", sql.NVarChar(64), body.name ?? "Region")
    .input("X", sql.Int, body.x ?? 0).input("Y", sql.Int, body.y ?? 0)
    .input("W", sql.Int, body.w ?? 24).input("H", sql.Int, body.h ?? 1)
    .input("StyleJSON", sql.NVarChar(sql.MAX), body.style ? JSON.stringify(body.style) : null)
    .input("OrderIndex", sql.Int, body.orderIndex ?? 0)
    .query(`
      INSERT INTO dbo.LayoutRegions (LayoutID, Kind, Name, X, Y, W, H, StyleJSON, OrderIndex)
      VALUES (@LayoutID, @Kind, @Name, @X, @Y, @W, @H, @StyleJSON, @OrderIndex);
      SELECT SCOPE_IDENTITY() AS id;
    `);
  return Number(r.recordset[0].id);
}

export async function updateRegion(regionId: number, body: Partial<LayoutRegion>) {
  const pool = await poolPromise;
  const req = pool.request().input("RegionID", sql.Int, regionId);
  const sets: string[] = [];

  const pairs = [
    ["Kind", "NVarChar(16)", body.kind],
    ["Name", "NVarChar(64)", body.name],
    ["X", "Int", body.x],
    ["Y", "Int", body.y],
    ["W", "Int", body.w],
    ["H", "Int", body.h],
    ["OrderIndex", "Int", body.orderIndex],
  ] as const;

  for (const [col, typ, val] of pairs) {
    if (val === undefined) continue;

    if (typ === "Int") {
      req.input(col, sql.Int, Number(val));
    } else if (typ.startsWith("NVarChar(")) {
      const sizeMatch = typ.match(/\((\d+)\)/);
      const size = sizeMatch ? Number(sizeMatch[1]) : 50; // safe default
      req.input(col, sql.NVarChar(size), String(val));
    } else {
      // Fallback (shouldn't happen with current pairs)
      req.input(col, sql.NVarChar(sql.MAX), String(val));
    }
    sets.push(`${col}=@${col}`);
  }

  if (body.style !== undefined) {
    req.input("StyleJSON", sql.NVarChar(sql.MAX), body.style ? JSON.stringify(body.style) : null);
    sets.push("StyleJSON=@StyleJSON");
  }

  if (sets.length === 0) return;

  await req.query(`UPDATE dbo/LayoutRegions SET ${sets.join(", ")} WHERE RegionID=@RegionID`);
}

export async function addBlock(regionId: number, body: Partial<LayoutBlock>): Promise<number> {
  const pool = await poolPromise;
  const r = await pool.request()
    .input("RegionID", sql.Int, regionId)
    .input("BlockType", sql.NVarChar(24), body.blockType ?? "Text")
    .input("SourceRef", sql.NVarChar(sql.MAX), body.sourceRef ? JSON.stringify(body.sourceRef) : null)
    .input("PropsJSON", sql.NVarChar(sql.MAX), body.props ? JSON.stringify(body.props) : null)
    .input("X", sql.Int, body.x ?? 0).input("Y", sql.Int, body.y ?? 0)
    .input("W", sql.Int, body.w ?? 6).input("H", sql.Int, body.h ?? 1)
    .input("OrderIndex", sql.Int, body.orderIndex ?? 0)
    .query(`
      INSERT INTO dbo.LayoutBlocks (RegionID, BlockType, SourceRef, PropsJSON, X, Y, W, H, OrderIndex)
      VALUES (@RegionID, @BlockType, @SourceRef, @PropsJSON, @X, @Y, @W, @H, @OrderIndex);
      SELECT SCOPE_IDENTITY() AS id;
    `);
  return Number(r.recordset[0].id);
}

export async function updateBlock(blockId: number, body: Partial<LayoutBlock>) {
  const pool = await poolPromise;
  const req = pool.request().input("BlockID", sql.Int, blockId);
  const sets: string[] = [];

  if (body.blockType) {
    req.input("BlockType", sql.NVarChar(24), body.blockType);
    sets.push("BlockType=@BlockType");
  }
  if (body.sourceRef !== undefined) {
    req.input("SourceRef", sql.NVarChar(sql.MAX), body.sourceRef ? JSON.stringify(body.sourceRef) : null);
    sets.push("SourceRef=@SourceRef");
  }
  if (body.props !== undefined) {
    req.input("PropsJSON", sql.NVarChar(sql.MAX), body.props ? JSON.stringify(body.props) : null);
    sets.push("PropsJSON=@PropsJSON");
  }

  const numericPairs = [
    ["X", body.x],
    ["Y", body.y],
    ["W", body.w],
    ["H", body.h],
    ["OrderIndex", body.orderIndex],
  ] as const;

  for (const [col, val] of numericPairs) {
    if (val === undefined) continue;
    req.input(col, sql.Int, Number(val));
    sets.push(`${col}=@${col}`);
  }

  if (sets.length === 0) return;

  await req.query(`UPDATE dbo/LayoutBlocks SET ${sets.join(", ")} WHERE BlockID=@BlockID`);
}

export async function saveSubsheetSlots(
  db: sql.ConnectionPool,
  layoutId: number,
  subId: number,
  payload: {
    merged?: boolean;
    left?: Array<{ index: number; infoTemplateId: number }>;
    right?: Array<{ index: number; infoTemplateId: number }>;
  }
): Promise<void> {
  const tx = new sql.Transaction(db);
  await tx.begin();

  try {
    const req = new sql.Request(tx);

    // delete existing rows for this (layoutId, subId)
    await req
      .input("layoutId", sql.Int, layoutId)
      .input("subId", sql.Int, subId)
      .query(`
        DELETE FROM dbo.LayoutSubsheetSlots
        WHERE LayoutID = @layoutId AND SubsheetID = @subId
      `);

    // insert new rows (left then right) — order becomes SlotIndex
    const all = [
      ...(payload.left ?? []).map((x) => ({ col: 1, idx: x.index, infoId: x.infoTemplateId })),
      ...(payload.right ?? []).map((x) => ({ col: 2, idx: x.index, infoId: x.infoTemplateId })),
    ].sort((a, b) => a.col - b.col || a.idx - b.idx);

    let slotIndex = 0;
    for (const r of all) {
      const ins = new sql.Request(tx);
      await ins
        .input("layoutId", sql.Int, layoutId)
        .input("subId", sql.Int, subId)
        .input("slotIndex", sql.Int, slotIndex++)
        .input("infoId", sql.Int, r.infoId)
        .input("col", sql.Int, r.col)
        .input("row", sql.Int, r.idx + 1)
        .query(`
          INSERT INTO dbo.LayoutSubsheetSlots
            (LayoutID, SubsheetID, SlotIndex, InfoTemplateID, ColumnNumber, RowNumber)
          VALUES
            (@layoutId, @subId, @slotIndex, @infoId, @col, @row)
        `);
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function saveLayoutBodySlots(
  layoutId: number,
  rows: BodySlotRow[]
): Promise<void> {
  const db = await poolPromise; // your original db.ts is fine
  const tx = new sql.Transaction(db);
  await tx.begin();

  try {
    await new sql.Request(tx)
      .input("layoutId", sql.Int, layoutId)
      .query(`DELETE FROM dbo.LayoutBodySlots WHERE LayoutID = @layoutId`);

    const sorted = [...rows].sort((a, b) => a.slotIndex - b.slotIndex);

    for (const r of sorted) {
      try {
        await new sql.Request(tx)
          .input("layoutId",     sql.Int, layoutId)
          .input("slotIndex",    sql.Int, r.slotIndex)
          .input("subsheetId",   sql.Int, r.subsheetId)
          .input("columnNumber", sql.Int, r.columnNumber)
          .input("rowNumber",    sql.Int, r.rowNumber)
          .input("width",        sql.Int, r.width)
          .query(`
            INSERT INTO dbo.LayoutBodySlots
              (LayoutID, SlotIndex, SubsheetID, ColumnNumber, RowNumber, Width)
            VALUES
              (@layoutId, @slotIndex, @subsheetId, @columnNumber, @rowNumber, @width)
          `);
      } catch (error_) {
        console.error("Insert failed for row:", r, "error:", error_);
        throw error_;
      }
    }

    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch { /* ignore */ }
    throw err;
  }
}

export async function listLayoutBodySlots(layoutId: number): Promise<BodySlotRowOut[]> {
  const db = await poolPromise;

  const rs = await db
    .request()
    .input("layoutId", sql.Int, layoutId)
    .query(`
      SELECT SlotIndex, SubsheetID, ColumnNumber, RowNumber, Width
      FROM dbo.LayoutBodySlots
      WHERE LayoutID = @layoutId
      ORDER BY SlotIndex
    `);

  const out: BodySlotRowOut[] = [];
  const recs = rs.recordset ?? [];

  for (const raw of recs) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;

    const slotIndex = toInt(r.SlotIndex);
    const subsheetId = toInt(r.SubsheetID);
    if (slotIndex === null || slotIndex < 0) continue;
    if (subsheetId === null || subsheetId <= 0) continue;

    const columnNumber = normalizeColumnNumber(r.ColumnNumber);
    const rowNumber = normalizeRowNumber(r.RowNumber);
    const width = normalizeWidth(r.Width);

    out.push({ slotIndex, subsheetId, columnNumber, rowNumber, width });
  }

  return out;
}

export async function renderLayout(args: RenderArgs): Promise<RenderPayload> {
  const { layoutId, sheetId, uom, lang } = args;
  const pool = await poolPromise;

  const sheet = await fetchSheet(pool, sheetId);
  const headerKVs = await fetchHeaderKVs(pool, sheetId);
  const headerFields = buildHeaderFields(headerKVs, uom, lang);

  const bodySlots = await fetchBodySlots(pool, layoutId);
  if (bodySlots.length === 0) {
    return buildPayload({ layoutId, sheetId, uom, lang, sheet, headerFields, body: [] });
  }

  const subsheetIds = Array.from(new Set(bodySlots.map(s => s.subsheetId)));
  const templates = await fetchTemplatesForSubs(pool, subsheetIds);
  if (templates.length === 0) {
    return buildPayload({ layoutId, sheetId, uom, lang, sheet, headerFields, body: [] });
  }

  // Layout-specific per-subsheet ordering
  const subSlots = await fetchSubsheetSlots(pool, layoutId, subsheetIds);
  const orderBySub = buildOrderMap(subSlots);

  // i18n cache (no-op for 'en' or if table missing)
  await primeTranslationsOrThrow(templates, lang);

  const allRows = await fetchSubsheetFieldsWithGroupingAll(pool, layoutId, sheetId, subsheetIds);
  const groupedBySub = new Map<number, GroupedFieldRow[]>();
  for (const r of allRows) {
    let arr = groupedBySub.get(r.subsheetId);
    if (!arr) { arr = []; groupedBySub.set(r.subsheetId, arr); }
    arr.push(r);
  }

  // Build render blocks from grouped rows while respecting orderBySub
  const body: RenderBlock[] = [];
  for (const slot of bodySlots) {
    const rows = groupedBySub.get(slot.subsheetId) ?? [];

    // Keep only placed templates and sort by the same rank you computed (column/row/slot)
    const ranks = orderBySub.get(slot.subsheetId) ?? new Map<number, number>();
    const placed = rows.filter(r => ranks.has(r.infoTemplateId));
    placed.sort((a, b) => {
      const ra = ranks.get(a.infoTemplateId)!;
      const rb = ranks.get(b.infoTemplateId)!;
      if (ra !== rb) return ra - rb;
      // secondary: columnNumber then cellIndex (NULLs last)
      const ca = (a.columnNumber ?? 1) - (b.columnNumber ?? 1);
      if (ca !== 0) return ca;
      return (a.cellIndex ?? 9999) - (b.cellIndex ?? 9999);
    });

    // Map to RenderField (you can extend RenderField to carry optional grouping props if desired)
    const fields: RenderField[] = placed.map(r => {
      const converted = getConvertedUOM(uom, r.uom ?? undefined);
      const value = formatFieldValue(uom, String(r.value ?? ""), r.uom ?? undefined, false);
      const label = getTranslatedFieldLabel(r.infoTemplateId, r.label, lang);

      const col: 1 | 2 = r.columnNumber === 2 ? 2 : 1; // force to 1|2

      return {
        infoTemplateId: r.infoTemplateId,
        label,
        value,
        rawValue: r.value,
        uom: converted || r.uom || undefined,
        groupKey: r.groupKey ?? undefined,
        cellIndex: r.cellIndex ?? undefined,
        cellCaption: r.cellCaption ?? undefined,
        columnNumber: col,
      };
    });

    body.push({ subsheetId: slot.subsheetId, fields });
  }

  return buildPayload({ layoutId, sheetId, uom, lang, sheet, headerFields, body });
}

// ───────────────────────────────── helpers ─────────────────────────────────
async function fetchSheet(pool: ConnectionPool, sheetId: number): Promise<SheetRow | null> {
  try {
    return await queryOne<SheetRow>(
      pool,
      `
      SELECT
        EquipmentTagNum,
        EquipmentName,
        CAST(CompanyProjNum AS NVARCHAR(64)) AS ProjectRef
      FROM dbo.Sheets
      WHERE SheetID = @sheetId
      `,
      req => { req.input("sheetId", Int, sheetId); }
    );
  } catch (e) {
    throw new Error(`Query Sheets failed (SheetID=${sheetId}): ${(e as Error).message}`);
  }
}

async function fetchHeaderKVs(pool: ConnectionPool, sheetId: number): Promise<HeaderKVRow[]> {
  try {
    return await queryMany<HeaderKVRow>(
      pool,
      `
      SELECT FieldKey, FieldValue, UOM
      FROM dbo.SheetHeaderKV
      WHERE SheetID = @sheetId
      ORDER BY SortOrder, FieldKey
      `,
      req => { req.input("sheetId", Int, sheetId); }
    );
  } catch (e) {
    throw new Error(`Query SheetHeaderKV failed (SheetID=${sheetId}): ${(e as Error).message}`);
  }
}

function buildHeaderFields(rows: HeaderKVRow[], uom: UomSystem, lang: LangCode): RenderField[] {
  const out: RenderField[] = [];
  for (const kv of rows) {
    const raw: string | null = kv.FieldValue ?? null;
    const converted = getConvertedUOM(uom, kv.UOM ?? undefined);
    const value = formatFieldValue(uom, String(raw ?? ""), kv.UOM ?? undefined, true);
    const label = getTranslatedFieldLabel(0, kv.FieldKey, lang);
    out.push({
      infoTemplateId: 0,
      label,
      value,
      rawValue: raw,
      uom: converted || kv.UOM || undefined,
    });
  }
  return out;
}

async function fetchBodySlots(pool: ConnectionPool, layoutId: number): Promise<BodySlotRow[]> {
  try {
    return await queryMany<BodySlotRow>(
      pool,
      `
      SELECT
        SlotIndex               AS slotIndex,
        SubsheetID              AS subsheetId,
        ISNULL(ColumnNumber,1)  AS columnNumber,
        ISNULL(RowNumber,1)     AS rowNumber,
        ISNULL(Width,1)         AS width
      FROM dbo.LayoutBodySlots
      WHERE LayoutID = @layoutId
      ORDER BY SlotIndex
      `,
      req => { req.input("layoutId", Int, layoutId); }
    );
  } catch (e) {
    throw new Error(`Query LayoutBodySlots failed (LayoutID=${layoutId}): ${(e as Error).message}`);
  }
}

async function fetchTemplatesForSubs(pool: ConnectionPool, subsheetIds: number[]): Promise<TemplateRow[]> {
  if (subsheetIds.length === 0) return [];
  const { clause, bind } = inClause("sub", subsheetIds);
  try {
    return await queryMany<TemplateRow>(
      pool,
      `
      SELECT
        it.InfoTemplateID,
        it.SubID AS SubsheetID,
        it.Label,
        it.UOM
      FROM dbo.InformationTemplates it
      WHERE it.SubID IN (${clause})
      ORDER BY it.SubID, it.InfoTemplateID
      `,
      req => { bind(req); }
    );
  } catch (e) {
    throw new Error(`Query InformationTemplates failed (SubID IN [...]): ${(e as Error).message}`);
  }
}

type SubsheetSlotRow = Readonly<{
  subsheetId: number;
  slotIndex: number;
  infoTemplateId: number;
  columnNumber: number;
  rowNumber: number;
}>;

async function fetchSubsheetSlots(
  pool: ConnectionPool,
  layoutId: number,
  subsheetIds: number[]
): Promise<SubsheetSlotRow[]> {
  if (subsheetIds.length === 0) return [];
  const { clause, bind } = inClause("sub", subsheetIds);
  try {
    return await queryMany<SubsheetSlotRow>(
      pool,
      `
      SELECT
        SubsheetID              AS subsheetId,
        SlotIndex               AS slotIndex,
        InfoTemplateID          AS infoTemplateId,
        ISNULL(ColumnNumber,1)  AS columnNumber,
        ISNULL(RowNumber,1)     AS rowNumber
      FROM dbo.LayoutSubsheetSlots
      WHERE LayoutID = @layoutId AND SubsheetID IN (${clause})
      `,
      req => { req.input("layoutId", Int, layoutId); bind(req); }
    );
  } catch (e) {
    throw new Error(`Query LayoutSubsheetSlots failed (LayoutID=${layoutId}): ${(e as Error).message}`);
  }
}

type GroupedFieldRow = {
  subsheetId: number;
  columnNumber: number | null;
  slotIndex: number;
  infoTemplateId: number;
  label: string;
  uom: string | null;
  value: string | null;
  groupKey: string | null;     // NULL for singletons
  cellIndex: number | null;    // NULL for singletons
  cellCaption: string | null;  // optional caption per cell (e.g., "min", "norm", "max")
};

async function fetchSubsheetFieldsWithGroupingAll(
  pool: ConnectionPool,
  layoutId: number,
  sheetId: number,
  subsheetIds: number[]
): Promise<GroupedFieldRow[]> {
  if (subsheetIds.length === 0) return [];
  const { clause, bind } = inClause("sub", subsheetIds);

  return await queryMany<GroupedFieldRow>(
    pool,
    `
    SELECT
      lss.SubsheetID                        AS subsheetId,
      lss.ColumnNumber                      AS columnNumber,
      lss.SlotIndex                         AS slotIndex,
      it.InfoTemplateID                     AS infoTemplateId,
      it.Label                              AS label,
      COALESCE(ivTop.UOM, it.UOM)           AS uom, 
      ivTop.InfoValue                       AS value,
      g.GroupKey                            AS groupKey,
      g.CellIndex                           AS cellIndex,
      g.CellCaption                         AS cellCaption
    FROM dbo.LayoutSubsheetSlots AS lss
    JOIN dbo.InformationTemplates AS it
      ON it.InfoTemplateID = lss.InfoTemplateID

    OUTER APPLY (
      SELECT TOP (1)
        v.InfoValue,
        v.UOM
      FROM dbo.InformationValues AS v
      WHERE v.InfoTemplateID = it.InfoTemplateID
        AND v.SheetID        = @sheetId
      ORDER BY
        ISNULL(v.RevisionID, 0) DESC, 
        CASE WHEN v.InfoValue IS NULL OR LTRIM(RTRIM(v.InfoValue)) = '' 
            THEN 1 ELSE 0 END, 
        v.InfoValue DESC 
    ) AS ivTop

    LEFT JOIN dbo.InfoTemplateGrouping AS g
      ON g.InfoTemplateID = it.InfoTemplateID
    WHERE lss.LayoutID   = @layoutId
      AND lss.SubsheetID IN (${clause})
    ORDER BY
      ISNULL(lss.ColumnNumber, 1),
      lss.SlotIndex,
      ISNULL(g.CellIndex, 9999);
    `,
    req => { req.input("layoutId", Int, layoutId); req.input("sheetId", Int, sheetId); bind(req); }
  );
}

function buildOrderMap(subSlots: SubsheetSlotRow[]): Map<number, Map<number, number>> {
  const orderBySub = new Map<number, Map<number, number>>();
  for (const s of subSlots) {
    let m = orderBySub.get(s.subsheetId);
    if (!m) {
      m = new Map<number, number>();
      orderBySub.set(s.subsheetId, m);
    }
    // Rank by (column, row, slotIndex)
    const rank = s.columnNumber * 1_000_000 + s.rowNumber * 1000 + s.slotIndex;
    if (!m.has(s.infoTemplateId)) m.set(s.infoTemplateId, rank);
  }
  return orderBySub;
}

async function primeTranslationsOrThrow(templates: TemplateRow[], lang: LangCode): Promise<void> {
  try {
    const tplIds = templates.map(t => t.InfoTemplateID);
    if (tplIds.length > 0) {
      await primeTemplateLabelTranslations(tplIds, lang);
    }
  } catch (e) {
    throw new Error(`primeTemplateLabelTranslations failed: ${(e as Error).message}`);
  }
}

function toMutable<T>(arr: ReadonlyArray<T>): T[] {
  return Array.isArray(arr) ? Array.from(arr) : [];
}

async function buildPayload(args: {
  layoutId: number;
  sheetId: number;
  uom: UomSystem;
  lang: LangCode;
  sheet: SheetRow | null;
  headerFields: ReadonlyArray<RenderField>;
  body: ReadonlyArray<RenderBlock>;
}): Promise<RenderPayload> {
  const { layoutId, sheetId, uom, lang, sheet, headerFields } = args;
  const originalBody = Array.isArray(args.body) ? args.body : [];

  // Collect distinct SubIDs present in the body
  const subsheetIds: number[] = [];
  for (const b of originalBody) {
    if (typeof b.subsheetId === "number" && Number.isFinite(b.subsheetId) && !subsheetIds.includes(b.subsheetId)) {
      subsheetIds.push(b.subsheetId);
    }
  }

  // Fetch names once from dbo.SubSheets
  const subNameMap = await getSubsheetNameMap(subsheetIds);

  // Normalize names per block
  const body: RenderBlock[] = originalBody.map((b) => ({
    ...b,
    subsheetName: resolveSubsheetName(b.subsheetId, b.subsheetName ?? null, subNameMap) ?? `Subsheet ${b.subsheetId}`,
  }));

  return {
    layoutId,
    sheetId,
    uom,
    lang,
    header: {
      equipmentTag: sheet?.EquipmentTagNum ?? null,
      equipmentName: sheet?.EquipmentName ?? null,
      project: sheet?.ProjectRef ?? null,
      fields: toMutable(headerFields),
    },
    body,
  };
}

export async function getLayoutStructureData(layoutId: number): Promise<{
  subsheets: Array<{ subsheetId: number; subsheetName: string }>;
}> {
  const pool = await poolPromise;

  // Get distinct SubIDs used by this layout (adjust table/column if needed)
  const idsResult = await pool.request()
    .input("LayoutID", sql.Int, layoutId)
    .query<{ SubsheetId: number }>(`
      SELECT DISTINCT lbs.SubsheetId
      FROM dbo.LayoutBodySlots AS lbs
      WHERE lbs.LayoutID = @LayoutID
      ORDER BY lbs.SubsheetId
    `);

  const ids: number[] = [];
  for (const r of idsResult.recordset) {
    const v = (r as unknown as { SubsheetId: unknown }).SubsheetId;
    if (typeof v === "number" && Number.isFinite(v)) ids.push(v);
  }

  const nameMap = await getSubsheetNameMap(ids);

  const subsheets = ids.map((id) => ({
    subsheetId: id,
    subsheetName: resolveSubsheetName(id, null, nameMap) ?? `Subsheet ${id}`,
  }));

  return { subsheets };
}

export async function getSubsheetSlots(layoutId: number, subId: number): Promise<SubsheetSlots> {
  const pool = await poolPromise;

  const q = `
    SELECT SlotIndex, InfoTemplateID, ColumnNumber
    FROM dbo.LayoutSubsheetSlots
    WHERE LayoutID = @LayoutID AND SubsheetID = @SubID
    ORDER BY SlotIndex ASC
  `;

  const rs = await pool.request()
    .input("LayoutID", sql.Int, layoutId)
    .input("SubID", sql.Int, subId)
    .query<{ SlotIndex: number; InfoTemplateID: number; ColumnNumber: number | null }>(q);

  if (!rs.recordset || rs.recordset.length === 0) {
    // Return a harmless default instead of throwing
    return { left: [], right: [], merged: false };
  }

  const left: number[] = [];
  const right: number[] = [];

  for (const row of rs.recordset) {
    const id = Number(row.InfoTemplateID);
    if (!Number.isFinite(id)) continue;
    const col = Number(row.ColumnNumber);
    if (col === 2) right.push(id);
    else left.push(id); // treat NULL/1 as left
  }

  // If only one side has entries, treat as merged for preview layout
  const merged = left.length === 0 || right.length === 0;

  return { left, right, merged };
}
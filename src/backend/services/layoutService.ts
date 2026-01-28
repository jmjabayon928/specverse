// src/backend/services/layoutService.ts
import type { ConnectionPool, IResult, Request } from 'mssql'
import { Int } from 'mssql'
import { poolPromise, sql } from '../config/db'
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
} from '@/domain/layouts/layoutTypes'
import {
  getConvertedUOM,
  formatFieldValue,
  getTranslatedFieldLabel,
  primeTemplateLabelTranslations,
} from '@/backend/services/i18nUomHelpers'

type RenderArgs = {
  layoutId: number
  sheetId: number
  uom: UomSystem
  lang: LangCode
}

type BindFn = (req: Request) => void
type SubsheetNameMap = Record<number, string>

type SubsheetSlots = Readonly<{
  left: number[]
  right: number[]
  merged: boolean
}>

interface SheetRow {
  EquipmentTagNum: string | null
  EquipmentName: string | null
  ProjectRef: string | null
}

interface HeaderKVRow {
  FieldKey: string
  FieldValue: string | null
  UOM: string | null
}

interface TemplateRow {
  InfoTemplateID: number
  SubsheetID: number
  Label: string
  UOM: string | null
}

type BodySlotRow = Readonly<{
  slotIndex: number
  subsheetId: number
  columnNumber: 1 | 2
  rowNumber: number
  width: 1 | 2
}>

type BodySlotRowOut = Readonly<{
  slotIndex: number
  subsheetId: number
  columnNumber: 1 | 2 | null
  rowNumber: number | null
  width: 1 | 2
}>

export type SubsheetSlotsConfig = Readonly<{
  merged: boolean
  left: ReadonlyArray<{ index: number; infoTemplateId: number }>
  right: ReadonlyArray<{ index: number; infoTemplateId: number }>
}>

type Row = Readonly<{
  InfoTemplateID: number
  ColumnNumber: number | null
  OrderInColumn: number
}>

export async function getSubsheetSlotsConfig(
  layoutId: number,
  subId: number,
): Promise<SubsheetSlotsConfig> {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('layoutId', sql.Int, layoutId)
    .input('subId', sql.Int, subId)
    .query<Row>(`
      SELECT InfoTemplateID, ColumnNumber, OrderInColumn
      FROM dbo.LayoutSubsheetSlots
      WHERE LayoutID = @layoutId AND SubsheetID = @subId
      ORDER BY ColumnNumber, OrderInColumn
    `)

  const rows: ReadonlyArray<Row> = result.recordset ?? []

  if (rows.length === 0) {
    return { merged: true, left: [], right: [] }
  }

  const left = rows
    .filter(row => (row.ColumnNumber ?? 1) === 1)
    .map(row => ({ index: row.OrderInColumn, infoTemplateId: row.InfoTemplateID }))

  const right = rows
    .filter(row => (row.ColumnNumber ?? 1) === 2)
    .map(row => ({ index: row.OrderInColumn, infoTemplateId: row.InfoTemplateID }))

  return { merged: false, left, right }
}

async function getSubsheetNameMap(ids: ReadonlyArray<number>): Promise<SubsheetNameMap> {
  const uniq: number[] = []

  for (const value of ids) {
    const isValidNumber = typeof value === 'number' && Number.isFinite(value)
    const alreadyAdded = uniq.includes(value)
    if (isValidNumber && !alreadyAdded) {
      uniq.push(value)
    }
  }

  if (uniq.length === 0) {
    return {}
  }

  const pool = await poolPromise

  const placeholders: string[] = []
  for (let index = 0; index < uniq.length; index += 1) {
    placeholders.push(`@p${index}`)
  }

  const queryText = `
    SELECT s.SubID, s.SubName
    FROM dbo.SubSheets AS s
    WHERE s.SubID IN (${placeholders.join(', ')})
  `

  const request = pool.request()
  for (let index = 0; index < uniq.length; index += 1) {
    request.input(`p${index}`, sql.Int, uniq[index])
  }

  const result = await request.query<{ SubID: number; SubName: string }>(queryText)

  const output: SubsheetNameMap = {}

  for (const row of result.recordset) {
    const hasValidName =
      typeof row.SubID === 'number' && typeof row.SubName === 'string' && row.SubName.trim()
    if (hasValidName) {
      output[row.SubID] = row.SubName.trim()
    }
  }

  return output
}

function resolveSubsheetName(
  id: number,
  candidate?: string | null,
  map?: Record<number, string>,
): string | null {
  const pick = (value?: string | null): string | null => {
    if (value === undefined || value === null) {
      return null
    }

    const trimmed = value.trim()
    if (!trimmed || /^\d+$/.test(trimmed)) {
      return null
    }

    return trimmed
  }

  return pick(candidate) ?? pick(map?.[id]) ?? null
}

function toInt(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isInteger(numeric)) {
    return null
  }

  return numeric
}

function normalizeColumnNumber(value: unknown): 1 | 2 | null {
  const numeric = Number(value)
  if (numeric === 1) {
    return 1
  }
  if (numeric === 2) {
    return 2
  }
  return null
}

function normalizeRowNumber(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isInteger(numeric) || numeric <= 0) {
    return null
  }

  return numeric
}

function normalizeWidth(value: unknown): 1 | 2 {
  const numeric = Number(value)
  if (numeric === 2) {
    return 2
  }

  return 1
}

async function queryOne<T>(
  pool: ConnectionPool,
  sqlText: string,
  bind?: BindFn,
): Promise<T | null> {
  const request = pool.request()
  if (bind) {
    bind(request)
  }

  const result: IResult<T> = await request.query(sqlText)
  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0]
}

async function queryMany<T>(
  pool: ConnectionPool,
  sqlText: string,
  bind?: BindFn,
): Promise<T[]> {
  const request = pool.request()
  if (bind) {
    bind(request)
  }

  const result: IResult<T> = await request.query(sqlText)
  return result.recordset
}

/**
 * Builds a parameterized IN (...) clause.
 * Example:
 *   const { clause, bind } = inClause('sub', [68, 69])
 *   WHERE x IN (${clause})
 *   bind(req)
 */
function inClause(nameBase: string, values: number[]) {
  const paramNames: string[] = []

  for (let index = 0; index < values.length; index += 1) {
    paramNames.push(`@${nameBase}${index}`)
  }

  const clause = paramNames.join(', ')
  const bind: BindFn = request => {
    let idx = 0
    for (const value of values) {
      request.input(`${nameBase}${idx}`, Int, value)
      idx += 1
    }
  }

  return { clause, bind }
}

export type InfoTemplateRow = Readonly<{
  InfoTemplateID: number
  Label: string
}>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isInfoTemplateRow(value: unknown): value is InfoTemplateRow {
  if (!isRecord(value)) {
    return false
  }

  const id = value['InfoTemplateID']
  const label = value['Label']

  return typeof id === 'number' && typeof label === 'string'
}

export async function listInfoTemplatesBySubId(
  db: sql.ConnectionPool,
  subId: number,
): Promise<InfoTemplateRow[]> {
  const result = await db
    .request()
    .input('subId', sql.Int, subId)
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
    `)

  const rows = (result.recordset ?? []) as unknown[]

  return rows.filter(isInfoTemplateRow).map(row => ({
    InfoTemplateID: row.InfoTemplateID,
    Label: row.Label,
  }))
}

export async function listLayouts(filter: {
  templateId: number | null
  clientId: number | null
}) {
  const pool = await poolPromise
  const request = pool.request()

  if (filter.templateId !== null) {
    request.input('TemplateID', sql.Int, filter.templateId)
  }
  if (filter.clientId !== null) {
    request.input('ClientID', sql.Int, filter.clientId)
  }

  const where: string[] = []

  if (filter.templateId !== null) {
    where.push('TemplateID = @TemplateID')
  }
  if (filter.clientId !== null) {
    where.push('ClientID = @ClientID')
  }

  const result = await request.query<{
    LayoutID: number
    TemplateID: number | null
    ClientID: number | null
    PaperSize: string
    Orientation: string
    GridCols: number
    GridGapMm: number
    MarginTopMm: number
    MarginRightMm: number
    MarginBottomMm: number
    MarginLeftMm: number
    Version: number
    IsDefault: boolean
  }>(`
    SELECT LayoutID, TemplateID, ClientID, PaperSize, Orientation, GridCols, GridGapMm,
           MarginTopMm, MarginRightMm, MarginBottomMm, MarginLeftMm, Version, IsDefault
    FROM dbo.DatasheetLayouts
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY LayoutID DESC
  `)

  return result.recordset
}

export async function getLayoutTemplateStructure(layoutId: number): Promise<{
  subsheets: Array<{ id: number; name: string }>
  fields: Array<{ id: number; label: string; subId: number | null }>
}> {
  const pool = await poolPromise

  const tmpl = await pool
    .request()
    .input('LayoutID', sql.Int, layoutId)
    .query(`
      SELECT TemplateID
      FROM DatasheetLayouts
      WHERE LayoutID = @LayoutID
    `)

  const templateId = Number(tmpl.recordset?.[0]?.TemplateID ?? 0)
  const isValidTemplate = Number.isFinite(templateId) && templateId > 0

  if (!isValidTemplate) {
    return { subsheets: [], fields: [] }
  }

  const subsRs = await pool
    .request()
    .input('SheetID', sql.Int, templateId)
    .query(`
      SELECT s.SubID AS id, s.SubName AS name
      FROM SubSheets s
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex, s.SubID
    `)

  const subsheets = (subsRs.recordset ?? []).map(row => ({
    id: Number(row.id),
    name: String(row.name ?? `Subsheet ${row.id}`),
  }))

  const fldRs = await pool
    .request()
    .input('SheetID', sql.Int, templateId)
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
    `)

  const rawFields = fldRs.recordset ?? []

  const fields = rawFields.map(row => ({
    id: Number(row.id),
    label: String(row.label ?? `Field ${row.id}`),
    subId: Number.isFinite(Number(row.subId)) ? Number(row.subId) : null,
  }))

  return { subsheets, fields }
}

export async function createLayout(args: {
  templateId: number | null
  clientId: number | null
  paperSize: PaperSize
  orientation: Orientation
}) {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('TemplateID', sql.Int, args.templateId)
    .input('ClientID', sql.Int, args.clientId)
    .input('PaperSize', sql.NVarChar(16), args.paperSize)
    .input('Orientation', sql.NVarChar(16), args.orientation)
    .query(`
      INSERT INTO dbo.DatasheetLayouts (TemplateID, ClientID, PaperSize, Orientation)
      VALUES (@TemplateID, @ClientID, @PaperSize, @Orientation);
      SELECT SCOPE_IDENTITY() AS id;
    `)

  const id = Number(result.recordset[0].id)

  await pool
    .request()
    .input('LayoutID', sql.Int, id)
    .query(`
      INSERT INTO dbo.LayoutRegions (LayoutID, Kind, Name, X, Y, W, H, OrderIndex)
      VALUES
        (@LayoutID, 'locked','Header',0,0,24,2,0),
        (@LayoutID, 'dynamic','Body',0,2,24,28,1),
        (@LayoutID, 'locked','Footer',0,30,24,2,2);
    `)

  return id
}

export async function getLayoutBundle(layoutId: number): Promise<LayoutBundle | null> {
  const pool = await poolPromise

  const metaQ = await pool
    .request()
    .input('LayoutID', sql.Int, layoutId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.DatasheetLayouts
      WHERE LayoutID = @LayoutID
    `)

  if (metaQ.recordset.length === 0) {
    return null
  }

  const metaRow = metaQ.recordset[0]

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
  }

  const regionsQ = await pool
    .request()
    .input('LayoutID', sql.Int, layoutId)
    .query(`
      SELECT *
      FROM dbo.LayoutRegions
      WHERE LayoutID = @LayoutID
      ORDER BY OrderIndex, RegionID
    `)

  const regions: LayoutRegion[] = regionsQ.recordset.map(row => ({
    regionId: row.RegionID,
    layoutId,
    kind: row.Kind,
    name: row.Name,
    x: row.X,
    y: row.Y,
    w: row.W,
    h: row.H,
    style: row.StyleJSON ? JSON.parse(row.StyleJSON) : null,
    orderIndex: row.OrderIndex,
  }))

  const blocksQ = await pool
    .request()
    .input('LayoutID', sql.Int, layoutId)
    .query(`
      SELECT b.*
      FROM dbo.LayoutBlocks b
      INNER JOIN dbo.LayoutRegions r ON r.RegionID = b.RegionID
      WHERE r.LayoutID = @LayoutID
      ORDER BY b.OrderIndex, b.BlockID
    `)

  const blocks: LayoutBlock[] = blocksQ.recordset.map(row => ({
    blockId: row.BlockID,
    regionId: row.RegionID,
    blockType: row.BlockType,
    sourceRef: row.SourceRef ? JSON.parse(row.SourceRef) : null,
    props: row.PropsJSON ? JSON.parse(row.PropsJSON) : null,
    x: row.X,
    y: row.Y,
    w: row.W,
    h: row.H,
    orderIndex: row.OrderIndex,
  }))

  return { meta, regions, blocks }
}

export async function updateLayoutMeta(layoutId: number, body: Partial<LayoutMeta>) {
  const pool = await poolPromise
  const request = pool.request().input('LayoutID', sql.Int, layoutId)

  const sets: string[] = []

  if (body.paperSize) {
    request.input('PaperSize', sql.NVarChar(16), body.paperSize)
    sets.push('PaperSize=@PaperSize')
  }

  if (body.orientation) {
    request.input('Orientation', sql.NVarChar(16), body.orientation)
    sets.push('Orientation=@Orientation')
  }

  if (body.gridCols !== undefined) {
    request.input('GridCols', sql.Int, body.gridCols)
    sets.push('GridCols=@GridCols')
  }

  if (body.gridGapMm !== undefined) {
    request.input('GridGapMm', sql.Decimal(9, 2), body.gridGapMm)
    sets.push('GridGapMm=@GridGapMm')
  }

  if (body.marginsMm) {
    request.input('MarginTopMm', sql.Decimal(9, 2), body.marginsMm.top)
    request.input('MarginRightMm', sql.Decimal(9, 2), body.marginsMm.right)
    request.input('MarginBottomMm', sql.Decimal(9, 2), body.marginsMm.bottom)
    request.input('MarginLeftMm', sql.Decimal(9, 2), body.marginsMm.left)

    sets.push(
      'MarginTopMm=@MarginTopMm',
      'MarginRightMm=@MarginRightMm',
      'MarginBottomMm=@MarginBottomMm',
      'MarginLeftMm=@MarginLeftMm',
    )
  }

  if (body.theme !== undefined) {
    const themeJson = body.theme ? JSON.stringify(body.theme) : null
    request.input('ThemeJSON', sql.NVarChar(sql.MAX), themeJson)
    sets.push('ThemeJSON=@ThemeJSON')
  }

  if (body.lockedHeader !== undefined) {
    const headerJson = body.lockedHeader ? JSON.stringify(body.lockedHeader) : null
    request.input('LockedHeaderJSON', sql.NVarChar(sql.MAX), headerJson)
    sets.push('LockedHeaderJSON=@LockedHeaderJSON')
  }

  if (body.lockedFooter !== undefined) {
    const footerJson = body.lockedFooter ? JSON.stringify(body.lockedFooter) : null
    request.input('LockedFooterJSON', sql.NVarChar(sql.MAX), footerJson)
    sets.push('LockedFooterJSON=@LockedFooterJSON')
  }

  if (sets.length === 0) {
    return
  }

  await request.query(
    `UPDATE dbo.DatasheetLayouts SET ${sets.join(
      ', ',
    )}, UpdatedAt=SYSUTCDATETIME() WHERE LayoutID=@LayoutID`,
  )
}

export async function addRegion(layoutId: number, body: Partial<LayoutRegion>): Promise<number> {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('LayoutID', sql.Int, layoutId)
    .input('Kind', sql.NVarChar(16), body.kind ?? 'dynamic')
    .input('Name', sql.NVarChar(64), body.name ?? 'Region')
    .input('X', sql.Int, body.x ?? 0)
    .input('Y', sql.Int, body.y ?? 0)
    .input('W', sql.Int, body.w ?? 24)
    .input('H', sql.Int, body.h ?? 1)
    .input(
      'StyleJSON',
      sql.NVarChar(sql.MAX),
      body.style ? JSON.stringify(body.style) : null,
    )
    .input('OrderIndex', sql.Int, body.orderIndex ?? 0)
    .query(`
      INSERT INTO dbo.LayoutRegions (LayoutID, Kind, Name, X, Y, W, H, StyleJSON, OrderIndex)
      VALUES (@LayoutID, @Kind, @Name, @X, @Y, @W, @H, @StyleJSON, @OrderIndex);
      SELECT SCOPE_IDENTITY() AS id;
    `)

  return Number(result.recordset[0].id)
}

export async function updateRegion(regionId: number, body: Partial<LayoutRegion>) {
  const pool = await poolPromise
  const request = pool.request().input('RegionID', sql.Int, regionId)

  const sets: string[] = []

  const pairs = [
    ['Kind', 'NVarChar(16)', body.kind],
    ['Name', 'NVarChar(64)', body.name],
    ['X', 'Int', body.x],
    ['Y', 'Int', body.y],
    ['W', 'Int', body.w],
    ['H', 'Int', body.h],
    ['OrderIndex', 'Int', body.orderIndex],
  ] as const

  for (const [column, type, value] of pairs) {
    if (value === undefined) {
      continue
    }

    if (type === 'Int') {
      request.input(column, sql.Int, Number(value))
    } else if (type.startsWith('NVarChar(')) {
      const match = type.match(/\((\d+)\)/)
      const size = match ? Number(match[1]) : 50
      request.input(column, sql.NVarChar(size), String(value))
    } else {
      request.input(column, sql.NVarChar(sql.MAX), String(value))
    }

    sets.push(`${column}=@${column}`)
  }

  if (body.style !== undefined) {
    request.input(
      'StyleJSON',
      sql.NVarChar(sql.MAX),
      body.style ? JSON.stringify(body.style) : null,
    )
    sets.push('StyleJSON=@StyleJSON')
  }

  if (sets.length === 0) {
    return
  }

  await request.query(`UPDATE dbo/LayoutRegions SET ${sets.join(', ')} WHERE RegionID=@RegionID`)
}

export async function addBlock(regionId: number, body: Partial<LayoutBlock>): Promise<number> {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('RegionID', sql.Int, regionId)
    .input('BlockType', sql.NVarChar(24), body.blockType ?? 'Text')
    .input(
      'SourceRef',
      sql.NVarChar(sql.MAX),
      body.sourceRef ? JSON.stringify(body.sourceRef) : null,
    )
    .input('PropsJSON', sql.NVarChar(sql.MAX), body.props ? JSON.stringify(body.props) : null)
    .input('X', sql.Int, body.x ?? 0)
    .input('Y', sql.Int, body.y ?? 0)
    .input('W', sql.Int, body.w ?? 6)
    .input('H', sql.Int, body.h ?? 1)
    .input('OrderIndex', sql.Int, body.orderIndex ?? 0)
    .query(`
      INSERT INTO dbo.LayoutBlocks (RegionID, BlockType, SourceRef, PropsJSON, X, Y, W, H, OrderIndex)
      VALUES (@RegionID, @BlockType, @SourceRef, @PropsJSON, @X, @Y, @W, @H, @OrderIndex);
      SELECT SCOPE_IDENTITY() AS id;
    `)

  return Number(result.recordset[0].id)
}

export async function updateBlock(blockId: number, body: Partial<LayoutBlock>) {
  const pool = await poolPromise
  const request = pool.request().input('BlockID', sql.Int, blockId)

  const sets: string[] = []

  if (body.blockType) {
    request.input('BlockType', sql.NVarChar(24), body.blockType)
    sets.push('BlockType=@BlockType')
  }

  if (body.sourceRef !== undefined) {
    request.input(
      'SourceRef',
      sql.NVarChar(sql.MAX),
      body.sourceRef ? JSON.stringify(body.sourceRef) : null,
    )
    sets.push('SourceRef=@SourceRef')
  }

  if (body.props !== undefined) {
    request.input(
      'PropsJSON',
      sql.NVarChar(sql.MAX),
      body.props ? JSON.stringify(body.props) : null,
    )
    sets.push('PropsJSON=@PropsJSON')
  }

  const numericPairs = [
    ['X', body.x],
    ['Y', body.y],
    ['W', body.w],
    ['H', body.h],
    ['OrderIndex', body.orderIndex],
  ] as const

  for (const [column, value] of numericPairs) {
    if (value === undefined) {
      continue
    }

    request.input(column, sql.Int, Number(value))
    sets.push(`${column}=@${column}`)
  }

  if (sets.length === 0) {
    return
  }

  await request.query(`UPDATE dbo/LayoutBlocks SET ${sets.join(', ')} WHERE BlockID=@BlockID`)
}

export async function saveSubsheetSlots(
  db: sql.ConnectionPool,
  layoutId: number,
  subId: number,
  payload: {
    merged?: boolean
    left?: Array<{ index: number; infoTemplateId: number }>
    right?: Array<{ index: number; infoTemplateId: number }>
  },
): Promise<void> {
  const transaction = new sql.Transaction(db)
  await transaction.begin()

  try {
    const request = new sql.Request(transaction)

    await request
      .input('layoutId', sql.Int, layoutId)
      .input('subId', sql.Int, subId)
      .query(`
        DELETE FROM dbo.LayoutSubsheetSlots
        WHERE LayoutID = @layoutId AND SubsheetID = @subId
      `)

    const all = [
      ...(payload.left ?? []).map(item => ({
        col: 1,
        idx: item.index,
        infoId: item.infoTemplateId,
      })),
      ...(payload.right ?? []).map(item => ({
        col: 2,
        idx: item.index,
        infoId: item.infoTemplateId,
      })),
    ].sort((a, b) => {
      if (a.col !== b.col) {
        return a.col - b.col
      }

      return a.idx - b.idx
    })

    let slotIndex = 0

    for (const row of all) {
      const insert = new sql.Request(transaction)

      await insert
        .input('layoutId', sql.Int, layoutId)
        .input('subId', sql.Int, subId)
        .input('slotIndex', sql.Int, slotIndex)
        .input('infoId', sql.Int, row.infoId)
        .input('col', sql.Int, row.col)
        .input('row', sql.Int, row.idx + 1)
        .query(`
          INSERT INTO dbo.LayoutSubsheetSlots
            (LayoutID, SubsheetID, SlotIndex, InfoTemplateID, ColumnNumber, RowNumber)
          VALUES
            (@layoutId, @subId, @slotIndex, @infoId, @col, @row)
        `)

      slotIndex += 1
    }

    await transaction.commit()
  } catch (error) {
    try {
      await transaction.rollback()
    } catch {
      // swallow rollback errors
    }
    throw error
  }
}

export async function saveLayoutBodySlots(
  layoutId: number,
  rows: BodySlotRow[],
): Promise<void> {
  const db = await poolPromise
  const transaction = new sql.Transaction(db)
  await transaction.begin()

  try {
    await new sql.Request(transaction)
      .input('layoutId', sql.Int, layoutId)
      .query(`
        DELETE FROM dbo.LayoutBodySlots
        WHERE LayoutID = @layoutId
      `)

    const sorted = [...rows].sort((a, b) => a.slotIndex - b.slotIndex)

    for (const row of sorted) {
      try {
        await new sql.Request(transaction)
          .input('layoutId', sql.Int, layoutId)
          .input('slotIndex', sql.Int, row.slotIndex)
          .input('subsheetId', sql.Int, row.subsheetId)
          .input('columnNumber', sql.Int, row.columnNumber)
          .input('rowNumber', sql.Int, row.rowNumber)
          .input('width', sql.Int, row.width)
          .query(`
            INSERT INTO dbo.LayoutBodySlots
              (LayoutID, SlotIndex, SubsheetID, ColumnNumber, RowNumber, Width)
            VALUES
              (@layoutId, @slotIndex, @subsheetId, @columnNumber, @rowNumber, @width)
          `)
      } catch (insertError) {
        console.error('Insert failed for row:', row, 'error:', insertError)
        throw insertError
      }
    }

    await transaction.commit()
  } catch (error) {
    try {
      await transaction.rollback()
    } catch {
      // swallow rollback errors
    }
    throw error
  }
}

export async function listLayoutBodySlots(layoutId: number): Promise<BodySlotRowOut[]> {
  const db = await poolPromise

  const result = await db
    .request()
    .input('layoutId', sql.Int, layoutId)
    .query(`
      SELECT SlotIndex, SubsheetID, ColumnNumber, RowNumber, Width
      FROM dbo.LayoutBodySlots
      WHERE LayoutID = @layoutId
      ORDER BY SlotIndex
    `)

  const output: BodySlotRowOut[] = []
  const records = result.recordset ?? []

  for (const raw of records) {
    if (!raw || typeof raw !== 'object') {
      continue
    }

    const row = raw as Record<string, unknown>

    const slotIndex = toInt(row.SlotIndex)
    const subsheetId = toInt(row.SubsheetID)

    const hasValidSlot = slotIndex !== null && slotIndex >= 0
    const hasValidSubsheet = subsheetId !== null && subsheetId > 0

    if (!hasValidSlot || !hasValidSubsheet) {
      continue
    }

    const columnNumber = normalizeColumnNumber(row.ColumnNumber)
    const rowNumber = normalizeRowNumber(row.RowNumber)
    const width = normalizeWidth(row.Width)

    output.push({ slotIndex, subsheetId, columnNumber, rowNumber, width })
  }

  return output
}

export async function renderLayout(args: RenderArgs): Promise<RenderPayload> {
  const { layoutId, sheetId, uom, lang } = args
  const pool = await poolPromise

  const sheet = await fetchSheet(pool, sheetId)
  const headerKVs = await fetchHeaderKVs(pool, sheetId)
  const headerFields = buildHeaderFields(headerKVs, uom, lang)

  const bodySlots = await fetchBodySlots(pool, layoutId)
  if (bodySlots.length === 0) {
    return buildPayload({ layoutId, sheetId, uom, lang, sheet, headerFields, body: [] })
  }

  const subsheetIds = Array.from(new Set(bodySlots.map(slot => slot.subsheetId)))
  const templates = await fetchTemplatesForSubs(pool, subsheetIds)
  if (templates.length === 0) {
    return buildPayload({ layoutId, sheetId, uom, lang, sheet, headerFields, body: [] })
  }

  const subSlots = await fetchSubsheetSlots(pool, layoutId, subsheetIds)
  const orderBySub = buildOrderMap(subSlots)

  await primeTranslationsOrThrow(templates, lang)

  const allRows = await fetchSubsheetFieldsWithGroupingAll(
    pool,
    layoutId,
    sheetId,
    subsheetIds,
  )

  const groupedBySub = new Map<number, GroupedFieldRow[]>()

  for (const row of allRows) {
    const existing = groupedBySub.get(row.subsheetId)
    if (existing) {
      existing.push(row)
      continue
    }

    groupedBySub.set(row.subsheetId, [row])
  }

  const body: RenderBlock[] = []

  for (const slot of bodySlots) {
    const rows = groupedBySub.get(slot.subsheetId) ?? []

    const ranks = orderBySub.get(slot.subsheetId) ?? new Map<number, number>()
    const placed = rows.filter(row => ranks.has(row.infoTemplateId))

    placed.sort((a, b) => {
      const ra = ranks.get(a.infoTemplateId) ?? 0
      const rb = ranks.get(b.infoTemplateId) ?? 0

      if (ra !== rb) {
        return ra - rb
      }

      const ca = (a.columnNumber ?? 1) - (b.columnNumber ?? 1)
      if (ca !== 0) {
        return ca
      }

      return (a.cellIndex ?? 9999) - (b.cellIndex ?? 9999)
    })

    const fields: RenderField[] = placed.map(row => {
      const converted = getConvertedUOM(uom, row.uom ?? undefined)
      const value = formatFieldValue(uom, String(row.value ?? ''), row.uom ?? undefined, false)
      const label = getTranslatedFieldLabel(row.infoTemplateId, row.label, lang)

      const col: 1 | 2 = row.columnNumber === 2 ? 2 : 1

      return {
        infoTemplateId: row.infoTemplateId,
        label,
        value,
        rawValue: row.value,
        uom: converted || row.uom || undefined,
        groupKey: row.groupKey ?? undefined,
        cellIndex: row.cellIndex ?? undefined,
        cellCaption: row.cellCaption ?? undefined,
        columnNumber: col,
      }
    })

    body.push({ subsheetId: slot.subsheetId, fields })
  }

  return buildPayload({ layoutId, sheetId, uom, lang, sheet, headerFields, body })
}

// ───────────────────────────── helpers ─────────────────────────────

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
      request => {
        request.input('sheetId', Int, sheetId)
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Query Sheets failed (SheetID=${sheetId}): ${message}`)
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
      request => {
        request.input('sheetId', Int, sheetId)
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Query SheetHeaderKV failed (SheetID=${sheetId}): ${message}`)
  }
}

function buildHeaderFields(
  rows: HeaderKVRow[],
  uom: UomSystem,
  lang: LangCode,
): RenderField[] {
  const output: RenderField[] = []

  for (const kv of rows) {
    const raw: string | null = kv.FieldValue ?? null
    const converted = getConvertedUOM(uom, kv.UOM ?? undefined)
    const value = formatFieldValue(uom, String(raw ?? ''), kv.UOM ?? undefined, true)
    const label = getTranslatedFieldLabel(0, kv.FieldKey, lang)

    output.push({
      infoTemplateId: 0,
      label,
      value,
      rawValue: raw,
      uom: converted || kv.UOM || undefined,
    })
  }

  return output
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
      request => {
        request.input('layoutId', Int, layoutId)
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Query LayoutBodySlots failed (LayoutID=${layoutId}): ${message}`)
  }
}

async function fetchTemplatesForSubs(
  pool: ConnectionPool,
  subsheetIds: number[],
): Promise<TemplateRow[]> {
  if (subsheetIds.length === 0) {
    return []
  }

  const { clause, bind } = inClause('sub', subsheetIds)

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
      request => {
        bind(request)
      },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(
      `Query InformationTemplates failed (SubID IN [...]) for subsheetIds=${subsheetIds.join(
        ',',
      )}: ${message}`,
    )
  }
}

type SubsheetSlotRow = Readonly<{
  subsheetId: number
  slotIndex: number
  infoTemplateId: number
  columnNumber: number
  rowNumber: number
}>

async function fetchSubsheetSlots(
  pool: ConnectionPool,
  layoutId: number,
  subsheetIds: number[],
): Promise<SubsheetSlotRow[]> {
  if (subsheetIds.length === 0) {
    return []
  }

  const { clause, bind } = inClause('sub', subsheetIds)

  return queryMany<SubsheetSlotRow>(
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
    request => {
      request.input('layoutId', Int, layoutId)
      bind(request)
    },
  )
}

type GroupedFieldRow = {
  subsheetId: number
  columnNumber: number | null
  slotIndex: number
  infoTemplateId: number
  label: string
  uom: string | null
  value: string | null
  groupKey: string | null
  cellIndex: number | null
  cellCaption: string | null
}

async function fetchSubsheetFieldsWithGroupingAll(
  pool: ConnectionPool,
  layoutId: number,
  sheetId: number,
  subsheetIds: number[],
): Promise<GroupedFieldRow[]> {
  if (subsheetIds.length === 0) {
    return []
  }

  const { clause, bind } = inClause('sub', subsheetIds)

  return queryMany<GroupedFieldRow>(
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
    request => {
      request.input('layoutId', Int, layoutId)
      request.input('sheetId', Int, sheetId)
      bind(request)
    },
  )
}

function buildOrderMap(subSlots: SubsheetSlotRow[]): Map<number, Map<number, number>> {
  const orderBySub = new Map<number, Map<number, number>>()

  for (const slot of subSlots) {
    const existing = orderBySub.get(slot.subsheetId)

    const mapToUse = existing ?? new Map<number, number>()
    if (!existing) {
      orderBySub.set(slot.subsheetId, mapToUse)
    }

    const rank = slot.columnNumber * 1_000_000 + slot.rowNumber * 1000 + slot.slotIndex

    if (!mapToUse.has(slot.infoTemplateId)) {
      mapToUse.set(slot.infoTemplateId, rank)
    }
  }

  return orderBySub
}

async function primeTranslationsOrThrow(
  templates: TemplateRow[],
  lang: LangCode,
): Promise<void> {
  const templateIds = templates.map(template => template.InfoTemplateID)
  if (templateIds.length === 0) {
    return
  }

  try {
    await primeTemplateLabelTranslations(templateIds, lang)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`primeTemplateLabelTranslations failed: ${message}`)
  }
}

function toMutable<T>(arr: ReadonlyArray<T>): T[] {
  if (Array.isArray(arr)) {
    return Array.from(arr)
  }

  return []
}

async function buildPayload(args: {
  layoutId: number
  sheetId: number
  uom: UomSystem
  lang: LangCode
  sheet: SheetRow | null
  headerFields: ReadonlyArray<RenderField>
  body: ReadonlyArray<RenderBlock>
}): Promise<RenderPayload> {
  const { layoutId, sheetId, uom, lang, sheet, headerFields } = args
  const originalBody = Array.isArray(args.body) ? args.body : []

  const subsheetIds: number[] = []

  for (const block of originalBody) {
    const isValid =
      typeof block.subsheetId === 'number' &&
      Number.isFinite(block.subsheetId) &&
      !subsheetIds.includes(block.subsheetId)

    if (isValid) {
      subsheetIds.push(block.subsheetId)
    }
  }

  const subNameMap = await getSubsheetNameMap(subsheetIds)

  const body: RenderBlock[] = originalBody.map(block => ({
    ...block,
    subsheetName:
      resolveSubsheetName(block.subsheetId, block.subsheetName ?? null, subNameMap) ??
      `Subsheet ${block.subsheetId}`,
  }))

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
  }
}

export async function getLayoutStructureData(layoutId: number): Promise<{
  subsheets: Array<{ subsheetId: number; subsheetName: string }>
}> {
  const pool = await poolPromise

  const idsResult = await pool
    .request()
    .input('LayoutID', sql.Int, layoutId)
    .query<{ SubsheetId: number }>(`
      SELECT DISTINCT lbs.SubsheetId
      FROM dbo.LayoutBodySlots AS lbs
      WHERE lbs.LayoutID = @LayoutID
      ORDER BY lbs.SubsheetId
    `)

  const ids: number[] = []

  for (const record of idsResult.recordset) {
    const value = (record as unknown as { SubsheetId: unknown }).SubsheetId

    const isValid = typeof value === 'number' && Number.isFinite(value)
    if (isValid) {
      ids.push(value)
    }
  }

  const nameMap = await getSubsheetNameMap(ids)

  const subsheets = ids.map(id => ({
    subsheetId: id,
    subsheetName: resolveSubsheetName(id, null, nameMap) ?? `Subsheet ${id}`,
  }))

  return { subsheets }
}

export async function getSubsheetSlots(
  layoutId: number,
  subId: number,
): Promise<SubsheetSlots> {
  const pool = await poolPromise

  const queryText = `
    SELECT SlotIndex, InfoTemplateID, ColumnNumber
    FROM dbo.LayoutSubsheetSlots
    WHERE LayoutID = @LayoutID AND SubsheetID = @SubID
    ORDER BY SlotIndex ASC
  `

  const result = await pool
    .request()
    .input('LayoutID', sql.Int, layoutId)
    .input('SubID', sql.Int, subId)
    .query<{ SlotIndex: number; InfoTemplateID: number; ColumnNumber: number | null }>(
      queryText,
    )

  const hasRecords = result.recordset && result.recordset.length > 0
  if (!hasRecords) {
    return { left: [], right: [], merged: false }
  }

  const left: number[] = []
  const right: number[] = []

  for (const row of result.recordset) {
    const id = Number(row.InfoTemplateID)
    if (!Number.isFinite(id)) {
      continue
    }

    const col = Number(row.ColumnNumber)
    if (col === 2) {
      right.push(id)
      continue
    }

    left.push(id)
  }

  const merged = left.length === 0 || right.length === 0

  return { left, right, merged }
}

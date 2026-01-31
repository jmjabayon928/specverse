// src/backend/services/valueSetService.ts
import { AppError } from '../errors/AppError'
import {
  getContextIdByCode,
  getValueSetId,
  ensureRequirementValueSet as ensureRequirementValueSetQuery,
  getValueSetStatus as getValueSetStatusQuery,
  getValueSetRow,
  createValueSet as createValueSetQuery,
  createOfferedValueSet as createOfferedValueSetQuery,
  createAsBuiltValueSet as createAsBuiltValueSetQuery,
  listValueSets as listValueSetsQuery,
  upsertVariance as upsertVarianceQuery,
  deleteVariance as deleteVarianceQuery,
  updateValueSetStatus as updateValueSetStatusQuery,
  getCompareStructure,
  getValueSetValues,
  getVariancesForValueSet,
  type ValueContextCode,
  type ValueSetRow,
  type VarianceStatus,
} from '../database/valueSetQueries'

export type { ValueContextCode, VarianceStatus }

export async function getContextIdByCodeSafe(code: ValueContextCode): Promise<number | null> {
  return getContextIdByCode(code)
}

export async function getValueSetIdSafe(
  sheetId: number,
  contextCode: ValueContextCode,
  partyId?: number | null
): Promise<number | null> {
  return getValueSetId(sheetId, contextCode, partyId)
}

/**
 * Ensure exactly one Requirement ValueSet for the sheet. Creates if missing. Returns ValueSetID.
 */
export async function ensureRequirementValueSet(
  sheetId: number,
  userId?: number | null
): Promise<number> {
  return ensureRequirementValueSetQuery(sheetId, userId)
}

export async function getValueSetStatus(
  valueSetId: number
): Promise<'Draft' | 'Locked' | 'Verified' | null> {
  return getValueSetStatusQuery(valueSetId)
}

export type { ValueSetRow }

export async function createValueSet(
  sheetId: number,
  contextCode: ValueContextCode,
  partyId?: number | null,
  userId?: number | null
): Promise<number> {
  return createValueSetQuery(sheetId, contextCode, partyId, userId)
}

/**
 * Create Offered ValueSet with prefill from Requirement. Idempotent for same (sheetId, partyId).
 */
export async function createOfferedValueSet(
  sheetId: number,
  partyId: number,
  userId?: number | null
): Promise<number> {
  return createOfferedValueSetQuery(sheetId, partyId, userId)
}

/**
 * Create AsBuilt ValueSet with prefill from Requirement. Idempotent.
 */
export async function createAsBuiltValueSet(
  sheetId: number,
  userId?: number | null
): Promise<number> {
  return createAsBuiltValueSetQuery(sheetId, userId)
}

export async function listValueSets(sheetId: number): Promise<ValueSetRow[]> {
  return listValueSetsQuery(sheetId)
}

/**
 * Patch variance: status null = delete row; else upsert with ReviewedBy/ReviewedAt.
 * Rejects if valueSetId does not belong to sheetId, Status != Draft, or context is Requirement.
 */
export async function patchVariance(
  sheetId: number,
  valueSetId: number,
  infoTemplateId: number,
  status: VarianceStatus | null,
  userId: number | null
): Promise<void> {
  const row = await getValueSetRow(valueSetId)
  if (row == null) {
    throw new AppError('ValueSet not found', 404)
  }
  if (row.SheetID !== sheetId) {
    throw new AppError('ValueSet does not belong to this sheet', 400)
  }
  if (row.Code === 'Requirement') {
    throw new AppError('Variances are not allowed on Requirement ValueSet', 400)
  }
  if (row.Status !== 'Draft') {
    throw new AppError(`Cannot change variance when ValueSet status is ${row.Status}`, 409)
  }
  if (status == null) {
    await deleteVarianceQuery(valueSetId, infoTemplateId)
    return
  }
  await upsertVarianceQuery(valueSetId, infoTemplateId, status, userId)
}

export type StatusTransition = 'Locked' | 'Verified'

/**
 * Transition ValueSet status. Requirement/Offered: Draft -> Locked only. AsBuilt: Draft -> Verified only.
 */
export async function transitionValueSetStatus(
  sheetId: number,
  valueSetId: number,
  status: StatusTransition
): Promise<void> {
  const row = await getValueSetRow(valueSetId)
  if (row == null) {
    throw new AppError('ValueSet not found', 404)
  }
  if (row.SheetID !== sheetId) {
    throw new AppError('ValueSet does not belong to this sheet', 400)
  }
  const current = row.Status as string
  if (current !== 'Draft') {
    throw new AppError(`Invalid transition: current status is ${current}`, 409)
  }
  if (row.Code === 'Requirement' || row.Code === 'Offered') {
    if (status !== 'Locked') {
      throw new AppError('Requirement/Offered can only transition to Locked', 409)
    }
    await updateValueSetStatusQuery(valueSetId, 'Locked')
    return
  }
  if (row.Code === 'AsBuilt') {
    if (status !== 'Verified') {
      throw new AppError('AsBuilt can only transition to Verified', 409)
    }
    await updateValueSetStatusQuery(valueSetId, 'Verified')
    return
  }
  throw new AppError('Unknown context', 400)
}

export type CompareFieldValue = {
  infoTemplateId: number
  label: string
  requirement: { value: string; uom: string | null }
  offered: Array<{
    partyId: number | null
    valueSetId: number
    value: string
    uom: string | null
    varianceStatus?: VarianceStatus
  }>
  asBuilt: { value: string; uom: string | null; varianceStatus?: VarianceStatus } | null
}

export type CompareSubsheet = {
  id: number
  name: string
  fields: CompareFieldValue[]
}

export type CompareResponse = {
  subsheets: CompareSubsheet[]
}

/**
 * GET compare: structure + requirement/offered/asBuilt values per field. offeredPartyId optional filter.
 */
export async function getCompareData(
  sheetId: number,
  offeredPartyId?: number | null
): Promise<CompareResponse> {
  const structure = await getCompareStructure(sheetId)
  const reqValueSetId = await getValueSetId(sheetId, 'Requirement', null)
  const requirementValues = reqValueSetId != null ? await getValueSetValues(reqValueSetId) : new Map()
  const asBuiltValueSetId = await getValueSetId(sheetId, 'AsBuilt', null)
  const asBuiltValues = asBuiltValueSetId != null ? await getValueSetValues(asBuiltValueSetId) : new Map()
  const asBuiltVariances = asBuiltValueSetId != null ? await getVariancesForValueSet(asBuiltValueSetId) : new Map()
  const allValueSets = await listValueSetsQuery(sheetId)
  const offeredSets = allValueSets.filter((vs) => vs.Code === 'Offered' && (offeredPartyId == null || vs.PartyID === offeredPartyId))

  const offeredData: Array<{ valueSetId: number; partyId: number | null; values: Map<number, { value: string; uom: string | null }>; variances: Map<number, VarianceStatus> }> = []
  for (const vs of offeredSets) {
    const values = await getValueSetValues(vs.ValueSetID)
    const variances = await getVariancesForValueSet(vs.ValueSetID)
    offeredData.push({ valueSetId: vs.ValueSetID, partyId: vs.PartyID, values, variances })
  }

  const bySub = new Map<number, CompareSubsheet>()
  for (const row of structure) {
    if (!bySub.has(row.SubID)) {
      bySub.set(row.SubID, { id: row.SubID, name: row.SubName, fields: [] })
    }
    const req = requirementValues.get(row.InfoTemplateID) ?? { value: '', uom: null }
    const asBuiltVal = asBuiltValues.get(row.InfoTemplateID) ?? { value: '', uom: null }
    const asBuiltVar = asBuiltVariances.get(row.InfoTemplateID)
    const asBuilt =
      asBuiltValueSetId != null
        ? { value: asBuiltVal.value, uom: asBuiltVal.uom, ...(asBuiltVar != null ? { varianceStatus: asBuiltVar } : {}) }
        : null
    const offered = offeredData.map((o) => {
      const v = o.values.get(row.InfoTemplateID) ?? { value: '', uom: null }
      const varianceStatus = o.variances.get(row.InfoTemplateID)
      return {
        partyId: o.partyId,
        valueSetId: o.valueSetId,
        value: v.value,
        uom: v.uom,
        ...(varianceStatus != null ? { varianceStatus } : {}),
      }
    })
    bySub.get(row.SubID)!.fields.push({
      infoTemplateId: row.InfoTemplateID,
      label: row.Label,
      requirement: { value: req.value, uom: req.uom },
      offered,
      asBuilt,
    })
  }

  const subsheets = Array.from(bySub.values()).sort((a, b) => a.id - b.id)
  return { subsheets }
}

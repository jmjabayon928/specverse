// src/backend/services/instrumentsService.ts
import { sheetBelongsToAccount } from './sheetAccessService'
import { AppError } from '../errors/AppError'
import {
  listByAccount,
  getById,
  create,
  update,
  listLinkedToSheet,
  linkToSheet,
  unlinkFromSheet,
  linkExists,
  listActiveTagRulesByAccount,
  type InstrumentRow,
  type InstrumentLinkedToSheetRow,
  type CreateInstrumentInput,
  type UpdateInstrumentInput,
  type InstrumentTagRuleRow,
} from '../repositories/instrumentsRepository'
import {
  getSnapshot,
  enqueueSnapshotRebuild,
  listSheetIdsLinkedToInstrument,
} from '../repositories/sheetInstrumentSnapshotsRepository'
import {
  parseAndValidateSnapshot,
  SHEET_INSTRUMENT_SNAPSHOT_VERSION,
} from './sheetInstrumentSnapshotsService'
import { kickSheetInstrumentSnapshotWorker } from '../workers/sheetInstrumentSnapshotWorker'

/**
 * Lightweight tag normalization: trim, uppercase, collapse whitespace, remove spaces around '-' and '/'.
 */
export function normalizeTag(input: string): string {
  let s = (input ?? '').trim()
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\s*-\s*/g, '-').replace(/\s*\/\s*/g, '/')
  return s.toUpperCase()
}

function validateTagAgainstRule(tag: string, tagNorm: string, rule: InstrumentTagRuleRow): void {
  // Prefix validation
  if (rule.prefix) {
    const prefixUpper = rule.prefix.toUpperCase()
    if (!tagNorm.startsWith(prefixUpper)) {
      throw new AppError(`Instrument tag must start with "${rule.prefix}"`, 400)
    }

    // Separator validation (if prefix exists)
    if (rule.separator) {
      const expectedStart = prefixUpper + rule.separator
      if (!tagNorm.startsWith(expectedStart)) {
        throw new AppError(`Instrument tag must start with "${rule.prefix}${rule.separator}"`, 400)
      }
    }
  }

  // AllowedAreaCodes validation
  if (rule.allowedAreaCodes) {
    const areaCodes = rule.allowedAreaCodes
      .split(',')
      .map((code: string) => code.trim().toUpperCase())
      .filter((code: string) => code.length > 0)
    if (areaCodes.length > 0) {
      let matched = false
      for (const areaCode of areaCodes) {
        const expectedPrefix = rule.separator
          ? areaCode + rule.separator
          : areaCode
        if (tagNorm.startsWith(expectedPrefix)) {
          matched = true
          break
        }
      }
      if (!matched) {
        const codesList = areaCodes.join(', ')
        throw new AppError(
          `Instrument tag must start with one of: ${codesList}${rule.separator ? rule.separator : ''}`,
          400
        )
      }
    }
  }

  // MinNumberDigits / MaxNumberDigits validation
  if (rule.minNumberDigits !== null || rule.maxNumberDigits !== null) {
    const digitMatch = tagNorm.match(/\d+$/)
    if (!digitMatch) {
      throw new AppError('Instrument tag must end with digits', 400)
    }
    const digitCount = digitMatch[0].length
    if (rule.minNumberDigits !== null && digitCount < rule.minNumberDigits) {
      throw new AppError(
        `Instrument tag must have at least ${rule.minNumberDigits} trailing digits`,
        400
      )
    }
    if (rule.maxNumberDigits !== null && digitCount > rule.maxNumberDigits) {
      throw new AppError(
        `Instrument tag must have at most ${rule.maxNumberDigits} trailing digits`,
        400
      )
    }
  }

  // RegexPattern validation
  if (rule.regexPattern) {
    let regex: RegExp
    try {
      regex = new RegExp(rule.regexPattern)
    } catch {
      throw new AppError('Instrument tag rules are misconfigured', 500)
    }
    if (!regex.test(tagNorm)) {
      throw new AppError('Instrument tag does not match required format', 400)
    }
  }
}

async function validateInstrumentTag(
  accountId: number,
  tag: string,
  tagNorm: string
): Promise<void> {
  const rules = await listActiveTagRulesByAccount(accountId)
  if (rules.length === 0) {
    return // No rules = no validation
  }
  if (rules.length > 1) {
    throw new AppError(
      'Multiple active instrument tag rules found. Please keep only one active rule per account.',
      400
    )
  }
  validateTagAgainstRule(tag, tagNorm, rules[0])
}

export type { InstrumentRow, InstrumentLinkedToSheetRow }

export async function listInstruments(
  accountId: number,
  searchQ?: string
): Promise<InstrumentRow[]> {
  return listByAccount(accountId, searchQ)
}

export async function getInstrument(
  accountId: number,
  instrumentId: number
): Promise<InstrumentRow | null> {
  return getById(accountId, instrumentId)
}

export async function createInstrument(
  accountId: number,
  input: { instrumentTag: string; instrumentType?: string | null; service?: string | null; system?: string | null; area?: string | null; location?: string | null; status?: string | null; notes?: string | null; createdBy?: number | null }
): Promise<InstrumentRow> {
  const tag = (input.instrumentTag ?? '').trim()
  if (!tag) {
    throw new AppError('Instrument tag is required', 400)
  }
  const instrumentTagNorm = normalizeTag(tag)
  await validateInstrumentTag(accountId, tag, instrumentTagNorm)
  const createInput: CreateInstrumentInput = {
    instrumentTag: tag,
    instrumentTagNorm,
    instrumentType: input.instrumentType ?? null,
    service: input.service ?? null,
    system: input.system ?? null,
    area: input.area ?? null,
    location: input.location ?? null,
    status: input.status ?? null,
    notes: input.notes ?? null,
    createdBy: input.createdBy ?? null,
  }
  return create(accountId, createInput)
}

export async function updateInstrument(
  accountId: number,
  instrumentId: number,
  input: { instrumentTag?: string; instrumentType?: string | null; service?: string | null; system?: string | null; area?: string | null; location?: string | null; status?: string | null; notes?: string | null; updatedBy?: number | null }
): Promise<InstrumentRow> {
  const existing = await getById(accountId, instrumentId)
  if (!existing) {
    throw new AppError('Instrument not found', 404)
  }
  const instrumentTag = input.instrumentTag !== undefined ? input.instrumentTag.trim() : existing.instrumentTag
  const instrumentTagNorm = instrumentTag ? normalizeTag(instrumentTag) : (existing.instrumentTagNorm ?? '')
  if (input.instrumentTag !== undefined) {
    await validateInstrumentTag(accountId, instrumentTag, instrumentTagNorm)
  }
  const updateInput: UpdateInstrumentInput = {
    instrumentTag,
    instrumentTagNorm,
    instrumentType: input.instrumentType !== undefined ? input.instrumentType : existing.instrumentType,
    service: input.service !== undefined ? input.service : existing.service,
    system: input.system !== undefined ? input.system : existing.system,
    area: input.area !== undefined ? input.area : existing.area,
    location: input.location !== undefined ? input.location : existing.location,
    status: input.status !== undefined ? input.status : existing.status,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    updatedBy: input.updatedBy ?? null,
  }
  const updated = await update(accountId, instrumentId, updateInput)
  if (!updated) {
    throw new AppError('Instrument not found', 404)
  }
  const sheetIds = await listSheetIdsLinkedToInstrument(accountId, instrumentId)
  for (const sid of sheetIds) {
    enqueueSnapshotRebuild(accountId, sid, 'instrument_update').catch(() => {})
  }
  if (sheetIds.length > 0) {
    kickSheetInstrumentSnapshotWorker()
  }
  return updated
}

export async function listInstrumentsLinkedToSheet(
  accountId: number,
  sheetId: number
): Promise<InstrumentLinkedToSheetRow[]> {
  let snapshot: Awaited<ReturnType<typeof getSnapshot>> = null
  try {
    snapshot = await getSnapshot(accountId, sheetId)
  } catch {
    // Snapshot DB error: treat as non-fatal, fall back to live query
  }
  const hadSnapshotRow = snapshot != null
  if (snapshot != null && snapshot.buildVersion === SHEET_INSTRUMENT_SNAPSHOT_VERSION) {
    const parsed = parseAndValidateSnapshot(snapshot.payloadJson, snapshot.buildVersion)
    if (parsed != null) return parsed
  }

  const rows = await listLinkedToSheet(accountId, sheetId)
  if (rows.length > 0) {
    const reason = hadSnapshotRow ? 'stale' : 'miss'
    enqueueSnapshotRebuild(accountId, sheetId, reason).catch(() => {})
    kickSheetInstrumentSnapshotWorker()
    return rows
  }
  const belongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }
  return []
}

export async function linkInstrumentToSheet(
  accountId: number,
  sheetId: number,
  instrumentId: number,
  linkRole: string | null,
  createdBy: number | null
): Promise<void> {
  const belongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }
  const instrument = await getById(accountId, instrumentId)
  if (!instrument) {
    throw new AppError('Instrument not found', 404)
  }
  const exists = await linkExists(accountId, instrumentId, sheetId)
  if (exists) {
    throw new AppError('Instrument is already linked to this datasheet', 409)
  }
  await linkToSheet(accountId, instrumentId, sheetId, linkRole, createdBy)
  enqueueSnapshotRebuild(accountId, sheetId, 'link').catch(() => {})
  kickSheetInstrumentSnapshotWorker()
}

export async function unlinkInstrumentFromSheet(
  accountId: number,
  sheetId: number,
  instrumentId: number,
  linkRole?: string | null
): Promise<void> {
  const belongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }
  const instrument = await getById(accountId, instrumentId)
  if (!instrument) {
    throw new AppError('Instrument not found', 404)
  }
  const removed = await unlinkFromSheet(accountId, instrumentId, sheetId, linkRole)
  if (!removed) {
    throw new AppError('Link not found or already removed', 404)
  }
  enqueueSnapshotRebuild(accountId, sheetId, 'unlink').catch(() => {})
  kickSheetInstrumentSnapshotWorker()
}

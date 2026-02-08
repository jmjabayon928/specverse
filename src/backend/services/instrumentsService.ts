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
  type InstrumentRow,
  type InstrumentLinkedToSheetRow,
  type CreateInstrumentInput,
  type UpdateInstrumentInput,
} from '../repositories/instrumentsRepository'

/**
 * Lightweight tag normalization: trim, uppercase, collapse whitespace, remove spaces around '-' and '/'.
 */
export function normalizeTag(input: string): string {
  let s = (input ?? '').trim()
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\s*-\s*/g, '-').replace(/\s*\/\s*/g, '/')
  return s.toUpperCase()
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
  return updated
}

export async function listInstrumentsLinkedToSheet(
  accountId: number,
  sheetId: number
): Promise<InstrumentLinkedToSheetRow[]> {
  const belongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }
  return listLinkedToSheet(accountId, sheetId)
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
}

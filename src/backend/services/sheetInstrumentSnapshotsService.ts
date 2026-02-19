// src/backend/services/sheetInstrumentSnapshotsService.ts
import { listLinkedToSheet, type InstrumentLinkedToSheetRow } from '../repositories/instrumentsRepository'

export const SHEET_INSTRUMENT_SNAPSHOT_VERSION = 1

/**
 * Build snapshot payload by calling listLinkedToSheet. Order is preserved (InstrumentTagNorm, InstrumentID).
 * The worker measures buildMs and instrumentCount (rows.length) and passes them to upsertSnapshot; when SNAPSHOT_DEBUG=1 these are logged.
 */
export async function buildSnapshotPayload(
  accountId: number,
  sheetId: number
): Promise<InstrumentLinkedToSheetRow[]> {
  return listLinkedToSheet(accountId, sheetId)
}

/**
 * Safe parse and validate snapshot payload. Returns array matching InstrumentLinkedToSheetRow[] or null if invalid/version mismatch.
 */
export function parseAndValidateSnapshot(
  payloadJson: string | null | undefined,
  buildVersion: number
): InstrumentLinkedToSheetRow[] | null {
  if (buildVersion !== SHEET_INSTRUMENT_SNAPSHOT_VERSION) return null
  if (payloadJson == null || typeof payloadJson !== 'string') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(payloadJson)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null
  const out: InstrumentLinkedToSheetRow[] = []
  for (const item of parsed) {
    if (item == null || typeof item !== 'object') return null
    const o = item as Record<string, unknown>
    const instrumentId = typeof o.instrumentId === 'number' && Number.isFinite(o.instrumentId) ? o.instrumentId : null
    const instrumentTag = typeof o.instrumentTag === 'string' ? o.instrumentTag : null
    const instrumentTagNorm =
      o.instrumentTagNorm === null || o.instrumentTagNorm === undefined
        ? null
        : typeof o.instrumentTagNorm === 'string'
          ? o.instrumentTagNorm
          : null
    const instrumentType =
      o.instrumentType === null || o.instrumentType === undefined
        ? null
        : typeof o.instrumentType === 'string'
          ? o.instrumentType
          : null
    const linkRole =
      o.linkRole === null || o.linkRole === undefined
        ? null
        : typeof o.linkRole === 'string'
          ? o.linkRole
          : null
    let loopTags: string[] = []
    if (Array.isArray(o.loopTags)) {
      loopTags = o.loopTags.filter((x): x is string => typeof x === 'string')
    }
    if (instrumentId === null || instrumentTag === null) return null
    out.push({
      instrumentId,
      instrumentTag,
      instrumentTagNorm,
      instrumentType,
      linkRole,
      loopTags,
    })
  }
  return out
}

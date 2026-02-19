// src/backend/workers/sheetInstrumentSnapshotWorker.ts
import type { ClaimedQueueRow } from '../repositories/sheetInstrumentSnapshotsRepository'
import {
  dequeueOneClaimed,
  dequeueManyClaimed,
  deleteQueueRow,
  releaseQueueClaim,
  upsertSnapshot,
  upsertSnapshotError,
} from '../repositories/sheetInstrumentSnapshotsRepository'
import { buildSnapshotPayload } from '../services/sheetInstrumentSnapshotsService'

const WORKER_ID = 'in-process-snapshot-v1'
const MAX_ATTEMPTS = 3
const MAX_SNAPSHOT_BYTES = 1_500_000
const MAX_ERROR_MESSAGE_CHARS = 500

let isScheduled = false

function shouldDebugSnapshots(): boolean {
  return process.env.SNAPSHOT_DEBUG === '1'
}

/**
 * Convert unknown error to a short string for LastError: strip newlines, collapse whitespace, max 500 chars.
 */
export function normalizeErrorForLog(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= MAX_ERROR_MESSAGE_CHARS) return collapsed
  return collapsed.slice(0, MAX_ERROR_MESSAGE_CHARS - 3) + '...'
}

/**
 * Debounced single kick: schedules one drain run via setImmediate. Prevents overlapping drains; if already scheduled, return.
 */
export function kickSheetInstrumentSnapshotWorker(): void {
  if (isScheduled) return
  isScheduled = true
  setImmediate(() => {
    drainQueue(5)
      .catch((err) => {
        console.error('Sheet instrument snapshot worker drain error:', err)
      })
      .finally(() => {
        isScheduled = false
      })
  })
}

/**
 * Process one already-claimed row: build, upsert snapshot, delete queue row. On failure: write LastError and either release claim (retry) or delete row (if Attempts >= 3).
 * Metadata (buildMs, instrumentCount) is passed to upsertSnapshot and optionally logged when SNAPSHOT_DEBUG=1.
 */
async function processOneClaimedRow(row: ClaimedQueueRow): Promise<void> {
  const { accountId, sheetId, attempts } = row
  const startMs = Date.now()
  const debug = shouldDebugSnapshots()
  try {
    const rows = await buildSnapshotPayload(accountId, sheetId)
    const buildMs = Date.now() - startMs
    const instrumentCount = rows.length
    const payloadJson = JSON.stringify(rows)
    const payloadBytes = Buffer.byteLength(payloadJson, 'utf8')
    if (payloadBytes > MAX_SNAPSHOT_BYTES) {
      const message = `Snapshot payload too large: ${payloadBytes} bytes`
      await upsertSnapshotError(accountId, sheetId, message)
      if (attempts >= MAX_ATTEMPTS) {
        await deleteQueueRow(accountId, sheetId)
      } else {
        await releaseQueueClaim(accountId, sheetId, WORKER_ID)
      }
      if (debug) {
        console.log('[snapshot-worker] row done', { accountId, sheetId, attempts, success: false, buildMs, instrumentCount })
      }
      return
    }
    await upsertSnapshot(accountId, sheetId, payloadJson, {
      buildMs,
      instrumentCount,
    })
    await deleteQueueRow(accountId, sheetId)
    if (debug) {
      console.log('[snapshot-worker] row done', { accountId, sheetId, attempts, success: true, buildMs, instrumentCount })
    }
  } catch (err) {
    const buildMs = Date.now() - startMs
    const message = normalizeErrorForLog(err)
    await upsertSnapshotError(accountId, sheetId, message)
    if (attempts >= MAX_ATTEMPTS) {
      await deleteQueueRow(accountId, sheetId)
    } else {
      await releaseQueueClaim(accountId, sheetId, WORKER_ID)
    }
    if (debug) {
      console.log('[snapshot-worker] row done', { accountId, sheetId, attempts, success: false, buildMs, instrumentCount: 0 })
    }
  }
}

/**
 * Process one queue item: claim, then process. On failure: write LastError and either release claim (retry) or delete row (if Attempts >= 3).
 */
export async function processQueueOnce(): Promise<boolean> {
  const claimed = await dequeueOneClaimed(WORKER_ID)
  if (!claimed) return false
  await processOneClaimedRow(claimed)
  return true
}

/**
 * Claim up to maxItems in one batch, then process each row sequentially.
 */
export async function drainQueue(maxItems: number): Promise<number> {
  const debug = shouldDebugSnapshots()
  if (debug) {
    console.log('[snapshot-worker] drainQueue start', { maxItems })
  }
  const rows = await dequeueManyClaimed(WORKER_ID, maxItems)
  for (const row of rows) {
    await processOneClaimedRow(row)
  }
  if (debug) {
    console.log('[snapshot-worker] drainQueue end', { processed: rows.length })
  }
  return rows.length
}

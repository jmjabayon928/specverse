// src/backend/services/assetActivityService.ts
import { AppError } from '../errors/AppError'
import {
  getAssetActivityRows,
  type AssetActivityLogRow,
  type AssetActivityCursor,
} from '@/backend/repositories/assetActivityRepository'

export interface AssetActivityResult {
  rows: AssetActivityLogRow[]
  nextCursor: AssetActivityCursor | null
}

export async function getAssetActivity(
  accountId: number,
  assetId: number,
  limit: number,
  cursor?: AssetActivityCursor
): Promise<AssetActivityResult> {
  // Validate limit
  if (limit < 1 || limit > 200) {
    throw new AppError('Limit must be between 1 and 200', 400)
  }

  // Validate cursor if provided
  if (cursor) {
    if (!cursor.performedAt || cursor.logId === undefined || cursor.logId === null) {
      throw new AppError('Invalid cursor: both performedAt and logId required', 400)
    }
    // Validate performedAt is valid ISO string
    const cursorDate = new Date(cursor.performedAt)
    if (isNaN(cursorDate.getTime())) {
      throw new AppError('Invalid cursor: performedAt must be valid ISO date string', 400)
    }
    if (!Number.isInteger(cursor.logId) || cursor.logId <= 0) {
      throw new AppError('Invalid cursor: logId must be positive integer', 400)
    }
  }

  const rows = await getAssetActivityRows(accountId, assetId, limit, cursor)

  // Compute nextCursor if we got a full page
  let nextCursor: AssetActivityCursor | null = null
  if (rows.length === limit && rows.length > 0) {
    const lastRow = rows[rows.length - 1]
    if (lastRow.performedAt != null && lastRow.logId != null) {
      nextCursor = {
        performedAt: lastRow.performedAt,
        logId: lastRow.logId,
      }
    }
  }

  return {
    rows,
    nextCursor,
  }
}

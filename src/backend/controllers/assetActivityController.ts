// src/backend/controllers/assetActivityController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { getAssetActivity as getAssetActivityService } from '@/backend/services/assetActivityService'

const paramsSchema = z.object({
  assetId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
})

const querySchema = z.object({
  limit: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return 50
        const num = Number(val)
        return Number.isFinite(num) ? num : 50
      },
      z.number().int().min(1).max(200)
    )
    .default(50),
  cursorPerformedAt: z.string().optional(),
  cursorLogId: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().positive().optional()),
})

export const getAssetActivity: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsedParams = paramsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      next(new AppError('Invalid asset ID', 400))
      return
    }

    const parsedQuery = querySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      next(new AppError('Invalid query parameters', 400))
      return
    }

    const assetId = parsedParams.data.assetId
    const limit = parsedQuery.data.limit ?? 50

    // Build cursor if both cursor params provided
    let cursor: { performedAt: string; logId: number } | undefined
    if (parsedQuery.data.cursorPerformedAt && parsedQuery.data.cursorLogId) {
      cursor = {
        performedAt: parsedQuery.data.cursorPerformedAt,
        logId: parsedQuery.data.cursorLogId,
      }
    } else if (parsedQuery.data.cursorPerformedAt || parsedQuery.data.cursorLogId) {
      // If only one cursor param provided, it's invalid
      next(new AppError('Both cursorPerformedAt and cursorLogId must be provided together', 400))
      return
    }

    const result = await getAssetActivityService(accountId, assetId, limit, cursor)

    res.status(200).json({
      rows: result.rows,
      nextCursor: result.nextCursor,
    })
  } catch (error) {
    if (typeof next === 'function') {
      next(error)
      return
    }
    if (res && typeof res.status === 'function') {
      res.status(500).json({ message: 'Internal server error' })
      return
    }
    // If neither next nor res.status are available, silently fail
    // (This should never happen in normal Express flow)
  }
}

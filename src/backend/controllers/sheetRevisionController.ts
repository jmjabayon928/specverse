// src/backend/controllers/sheetRevisionController.ts
import type { Request, RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { listRevisionsPaged, getRevisionById, createRevision, REVISION_SNAPSHOT_INVALID_MESSAGE } from '../database/sheetRevisionQueries'
import { updateFilledSheet, getFilledSheetDetailsById } from '../services/filledSheetService'
import { sheetBelongsToAccount } from '../services/sheetAccessService'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { poolPromise, sql } from '../config/db'
import { unifiedSheetSchema } from '@/validation/sheetSchema'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'
import type { UserSession } from '@/domain/auth/sessionTypes'

const idParamsSchema = z.object({
  id: z.string(),
})

const revisionIdParamsSchema = z.object({
  id: z.string(),
  revisionId: z.string(),
})

const listRevisionsQuerySchema = z.object({
  page: z.string().optional().transform(val => (val ? Number(val) : 1)),
  pageSize: z.string().optional().transform(val => (val ? Number(val) : 20)),
})

const restoreBodySchema = z.object({
  comment: z.string().optional(),
})

function asUser(req: Request): UserSession | null {
  const maybeUser = req.user as UserSession | undefined
  if (maybeUser == null) {
    return null
  }
  return maybeUser
}

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') {
    return null
  }

  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

/**
 * GET /api/backend/filledsheets/:id/revisions
 * List revisions for a filled sheet with pagination
 */
export const listRevisionsHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = idParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)

    if (sheetId == null) {
      next(new AppError('Invalid sheet ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const parsedQuery = listRevisionsQuerySchema.parse(req.query)
    const page = Math.max(1, parsedQuery.page ?? 1)
    const pageSize = Math.min(100, Math.max(1, parsedQuery.pageSize ?? 20))

    const result = await listRevisionsPaged(sheetId, page, pageSize)

    res.status(200).json({
      page,
      pageSize,
      total: result.total,
      rows: result.rows.map(row => ({
        revisionId: row.revisionId,
        revisionNumber: row.revisionNumber,
        createdAt: row.createdAt.toISOString(),
        createdBy: row.createdBy,
        createdByName: row.createdByName,
        status: row.status,
        comment: row.comment,
        systemRevisionNum: row.systemRevisionNum,
        systemRevisionAt: row.systemRevisionAt.toISOString(),
      })),
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      next(new AppError('Invalid request parameters', 400))
      return
    }
    next(err)
  }
}

/**
 * GET /api/backend/filledsheets/:id/revisions/:revisionId
 * Get a specific revision with its snapshot
 */
export const getRevisionHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = revisionIdParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)
    const revisionId = parseId(parsedParams.revisionId)

    if (sheetId == null || revisionId == null) {
      next(new AppError('Invalid sheet ID or revision ID', 400))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const revision = await getRevisionById(sheetId, revisionId)

    if (revision == null) {
      next(new AppError('Revision not found', 404))
      return
    }

    res.status(200).json({
      revisionId: revision.revisionId,
      revisionNumber: revision.revisionNumber,
      createdAt: revision.createdAt.toISOString(),
      createdBy: revision.createdBy,
      createdByName: revision.createdByName,
      status: revision.status,
      comment: revision.comment,
      snapshot: revision.snapshot as UnifiedSheet,
      systemRevisionNum: revision.systemRevisionNum,
      systemRevisionAt: revision.systemRevisionAt.toISOString(),
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      next(new AppError('Invalid request parameters', 400))
      return
    }
    next(err)
  }
}

/**
 * POST /api/backend/filledsheets/:id/revisions/:revisionId/restore
 * Restore a revision by creating a new revision with the snapshot data
 */
export const restoreRevisionHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsedParams = revisionIdParamsSchema.parse(req.params)
    const sheetId = parseId(parsedParams.id)
    const revisionId = parseId(parsedParams.revisionId)

    if (sheetId == null || revisionId == null) {
      next(new AppError('Invalid sheet ID or revision ID', 400))
      return
    }

    const user = asUser(req)
    if (user?.userId == null) {
      next(new AppError('Unauthorized', 401))
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError('Sheet not found', 404))
      return
    }

    const parsedBody = restoreBodySchema.parse(req.body)
    const comment = parsedBody.comment

    // Get the revision snapshot
    const revision = await getRevisionById(sheetId, revisionId)
    if (revision == null) {
      next(new AppError('Revision not found', 404))
      return
    }

    // Validate snapshot structure (defensive check for corrupted data)
    const snapshotValidation = unifiedSheetSchema.safeParse(revision.snapshot)
    if (!snapshotValidation.success) {
      next(new AppError('Invalid revision snapshot data', 500))
      return
    }

    const snapshot = snapshotValidation.data

    // Verify the sheet still exists
    const currentSheet = await getFilledSheetDetailsById(sheetId, 'eng', 'SI', accountId)
    if (currentSheet == null) {
      next(new AppError('Sheet not found', 404))
      return
    }

    // Restore by calling updateFilledSheet with the snapshot
    // Skip revision creation during restore to avoid recursion
    const updateResult = await updateFilledSheet(
      sheetId,
      snapshot,
      user.userId,
      { skipRevisionCreation: true, allowHeaderUpdate: true }
    )

    // Now create a new revision representing the restored state
    // Get the updated sheet to create the revision snapshot
    const updatedSheet = await getFilledSheetDetailsById(sheetId, 'eng', 'SI', accountId)
    if (updatedSheet == null) {
      next(new AppError('Failed to retrieve updated sheet', 500))
      return
    }

    // Create revision for the restored state (in its own transaction)
    const pool = await poolPromise
    const transaction = new sql.Transaction(pool)
    let didBegin = false
    let didCommit = false

    try {
      await transaction.begin()
      didBegin = true

      const newRevisionId = await createRevision(transaction, {
        sheetId,
        snapshotJson: JSON.stringify(updatedSheet.datasheet),
        createdById: user.userId,
        createdByDate: new Date(),
        status: updatedSheet.datasheet.status ?? 'Modified Draft',
        notes: comment ?? `Restored from revision #${revision.revisionNumber}`,
      })

      await transaction.commit()
      didCommit = true

      res.status(200).json({
        sheetId: updateResult.sheetId,
        restoredFromRevisionId: revisionId,
        newRevisionId,
        message: `Sheet restored from revision #${revision.revisionNumber}. New revision #${newRevisionId} created.`,
      })
    } catch (error) {
      if (didBegin && !didCommit) {
        try {
          await transaction.rollback()
        } catch (rollbackErr: unknown) {
          console.error('rollback failed', rollbackErr)
        }
      }
      throw error
    }
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      next(new AppError('Invalid request parameters', 400))
      return
    }
    if (err instanceof Error && err.message === REVISION_SNAPSHOT_INVALID_MESSAGE) {
      console.error('createRevision snapshot validation failed', err)
      next(new AppError('Unable to create a revision snapshot. Please try again or contact support.', 500))
      return
    }
    next(err)
  }
}

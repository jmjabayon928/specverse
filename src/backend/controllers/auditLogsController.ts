// src/backend/controllers/auditLogsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { listAuditLogs, type ListAuditLogsParams } from '../services/auditLogsService'

const listAuditLogsQuerySchema = z.object({
  page: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return 1
        const num = Number(val)
        return Number.isFinite(num) ? num : 1
      },
      z.number().int().min(1)
    )
    .default(1),
  pageSize: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return 20
        const num = Number(val)
        return Number.isFinite(num) ? num : 20
      },
      z.number().int().min(1).max(100)
    )
    .default(20),
  actorUserId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined
        const num = Number(val)
        return Number.isFinite(num) ? num : undefined
      },
      z.number().int().positive().optional()
    )
    .optional(),
  action: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  entityId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined
        const num = Number(val)
        return Number.isFinite(num) ? num : undefined
      },
      z.number().int().positive().optional()
    )
    .optional(),
  dateFrom: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined
        if (typeof val === 'string') {
          const date = new Date(val)
          return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
        }
        return undefined
      },
      z.string().optional()
    )
    .optional(),
  dateTo: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined
        if (typeof val === 'string') {
          const date = new Date(val)
          if (Number.isNaN(date.getTime())) return undefined
          // Make dateTo inclusive of entire day: set to end of day (23:59:59.999)
          const endOfDay = new Date(date)
          endOfDay.setHours(23, 59, 59, 999)
          return endOfDay.toISOString()
        }
        return undefined
      },
      z.string().optional()
    )
    .optional(),
})

/**
 * GET /api/backend/audit-logs
 * List audit logs with pagination and optional filters.
 * Requires admin role.
 */
export const listAuditLogsHandler: RequestHandler = async (req, res, next) => {
  try {
    const parsed = listAuditLogsQuerySchema.safeParse(req.query)

    if (!parsed.success) {
      next(new AppError('Invalid query parameters', 400))
      return
    }

    const params: ListAuditLogsParams = {
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      actorUserId: parsed.data.actorUserId,
      action: parsed.data.action,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      dateFrom: parsed.data.dateFrom,
      dateTo: parsed.data.dateTo,
    }

    // Enforce bounds
    if (params.page < 1) {
      next(new AppError('Page must be >= 1', 400))
      return
    }

    if (params.pageSize < 1 || params.pageSize > 100) {
      next(new AppError('Page size must be between 1 and 100', 400))
      return
    }

    const result = await listAuditLogs(params)
    res.json(result)
  } catch (err) {
    console.error('listAuditLogsHandler error:', err)
    next(new AppError('Failed to fetch audit logs', 500))
  }
}

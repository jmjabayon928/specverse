// src/backend/controllers/exportJobsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { getExportJobById } from '../database/exportJobQueries'
import {
  startExportJob,
  getExportJobStatus,
  resolveExportFilePath,
  generateDownloadToken,
  verifyDownloadToken,
  cancelExportJob,
  retryExportJob,
  cleanupExpiredExportJobs,
} from '../services/exportJobService'

const startExportBodySchema = z.object({
  jobType: z.literal('inventory_transactions_csv'),
  params: z
    .object({
      warehouseId: z.number().int().positive().optional(),
      itemId: z.number().int().positive().optional(),
      transactionType: z.string().optional(),
      dateFrom: z
        .union([z.string(), z.date()])
        .transform((v) => (typeof v === 'string' ? new Date(v) : v))
        .optional(),
      dateTo: z
        .union([z.string(), z.date()])
        .transform((v) => (typeof v === 'string' ? new Date(v) : v))
        .optional(),
    })
    .optional()
    .default({}),
})

const jobIdParamSchema = z.object({
  jobId: z
    .string()
    .transform((v) => parseInt(v, 10))
    .refine((n) => Number.isInteger(n) && n > 0, 'Invalid jobId'),
})

function isOwnerOrAdmin(
  userId: number,
  role: string | undefined,
  createdBy: number
): boolean {
  if (userId === createdBy) return true
  if (role?.toLowerCase() === 'admin') return true
  return false
}

export const startExportJobHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user?.userId) {
      next(new AppError('Missing user in request', 403))
      return
    }
    const parsed = startExportBodySchema.safeParse(req.body)
    if (!parsed.success) {
      next(new AppError('Invalid request body', 400))
      return
    }
    const { jobType, params } = parsed.data
    const result = await startExportJob({
      jobType,
      params: params as Record<string, unknown>,
      userId: req.user.userId,
    })
    res.status(201).json({
      jobId: result.jobId,
      status: result.status,
      createdAt: result.createdAt,
    })
  } catch (err: unknown) {
    const ex = err as Error & { statusCode?: number }
    if (ex.statusCode === 413) {
      res.status(413).json({ message: ex.message })
      return
    }
    next(err)
  }
}

export const getExportJobStatusHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?.userId) {
      next(new AppError('Missing user in request', 403))
      return
    }
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      next(new AppError('Invalid jobId', 400))
      return
    }
    const { jobId } = parsed.data
    const row = await getExportJobById(jobId)
    if (!row) {
      next(new AppError('Export job not found', 404))
      return
    }
    if (
      !isOwnerOrAdmin(req.user.userId, req.user.role, row.CreatedBy)
    ) {
      next(new AppError('Permission denied', 403))
      return
    }
    const status = await getExportJobStatus(jobId)
    if (!status) {
      next(new AppError('Export job not found', 404))
      return
    }
    res.status(200).json(status)
  } catch (err) {
    next(err)
  }
}

export const downloadExportJobHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      next(new AppError('Invalid jobId', 400))
      return
    }
    const { jobId } = parsed.data

    const tokenParam = typeof req.query.token === 'string' ? req.query.token : null

    if (tokenParam) {
      const payload = verifyDownloadToken(tokenParam)
      if (!payload || payload.jobId !== jobId) {
        next(new AppError('Invalid or expired download link', 403))
        return
      }
      const row = await getExportJobById(jobId)
      if (!row) {
        next(new AppError('Export job not found', 404))
        return
      }
      if (payload.userId !== row.CreatedBy) {
        next(new AppError('Permission denied', 403))
        return
      }
    } else {
      if (!req.user?.userId) {
        next(new AppError('Unauthorized', 401))
        return
      }
      const row = await getExportJobById(jobId)
      if (!row) {
        next(new AppError('Export job not found', 404))
        return
      }
      if (
        !isOwnerOrAdmin(req.user.userId, req.user.role, row.CreatedBy)
      ) {
        next(new AppError('Permission denied', 403))
        return
      }
    }

    const resolved = await resolveExportFilePath(jobId)
    if (!resolved) {
      res.status(410).json({
        message: 'Export expired or file no longer available',
      })
      return
    }
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resolved.fileName}"`
    )
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.status(200).sendFile(resolved.absolutePath, (err) => {
      if (err) next(err)
    })
  } catch (err) {
    next(err)
  }
}

export const getDownloadUrlHandler: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user?.userId) {
      next(new AppError('Missing user in request', 403))
      return
    }
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      next(new AppError('Invalid jobId', 400))
      return
    }
    const { jobId } = parsed.data
    const row = await getExportJobById(jobId)
    if (!row) {
      next(new AppError('Export job not found', 404))
      return
    }
    if (
      !isOwnerOrAdmin(req.user.userId, req.user.role, row.CreatedBy)
    ) {
      next(new AppError('Permission denied', 403))
      return
    }
    const resolved = await resolveExportFilePath(jobId)
    if (!resolved) {
      res.status(410).json({
        message: 'Export expired or file no longer available',
      })
      return
    }
    const token = generateDownloadToken(jobId, req.user.userId)
    const origin = `${req.protocol}://${req.get('host')}`
    const downloadUrl = `${origin}/api/backend/exports/jobs/${jobId}/download?token=${encodeURIComponent(token)}`
    res.status(200).json({ downloadUrl, fileName: resolved.fileName })
  } catch (err) {
    next(err)
  }
}

export const cancelExportJobHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?.userId) {
      next(new AppError('Missing user in request', 403))
      return
    }
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      next(new AppError('Invalid jobId', 400))
      return
    }
    const { jobId } = parsed.data
    const row = await getExportJobById(jobId)
    if (!row) {
      next(new AppError('Export job not found', 404))
      return
    }
    if (
      !isOwnerOrAdmin(req.user.userId, req.user.role, row.CreatedBy)
    ) {
      next(new AppError('Permission denied', 403))
      return
    }
    const cancelled = await cancelExportJob(jobId)
    if (!cancelled) {
      res.status(400).json({
        message: 'Job cannot be cancelled (already completed or cancelled)',
      })
      return
    }
    const status = await getExportJobStatus(jobId)
    res.status(200).json(status)
  } catch (err) {
    next(err)
  }
}

export const retryExportJobHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?.userId) {
      next(new AppError('Missing user in request', 403))
      return
    }
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      next(new AppError('Invalid jobId', 400))
      return
    }
    const { jobId } = parsed.data
    const row = await getExportJobById(jobId)
    if (!row) {
      next(new AppError('Export job not found', 404))
      return
    }
    if (
      !isOwnerOrAdmin(req.user.userId, req.user.role, row.CreatedBy)
    ) {
      next(new AppError('Permission denied', 403))
      return
    }
    const accepted = await retryExportJob(jobId)
    if (!accepted) {
      res.status(400).json({
        message:
          'Job cannot be retried (only failed jobs can be retried)',
      })
      return
    }
    const status = await getExportJobStatus(jobId)
    res.status(200).json(status)
  } catch (err) {
    next(err)
  }
}

export const cleanupExportJobsHandler: RequestHandler = async (
  req,
  res,
  next
) => {
  try {
    const result = await cleanupExpiredExportJobs()
    res.status(200).json({
      message: 'Cleanup completed',
      deletedFiles: result.deletedFiles,
    })
  } catch (err) {
    next(err)
  }
}

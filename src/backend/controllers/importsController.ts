// src/backend/controllers/importsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { mustGetAccountId } from '../utils/authGuards'
import { previewImport, runImport } from '../services/importService'
import { validateFile } from '../utils/fileParser'
import fs from 'fs/promises'
import crypto from 'crypto'

const runImportBodySchema = z.object({
  jobId: z.number().int().positive(),
  options: z
    .object({
      skipErrors: z.boolean().optional(),
      createCustomFields: z.boolean().optional(),
    })
    .optional()
    .default({}),
})

/**
 * Get or generate correlation ID from request
 */
function getCorrelationId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const headerId = req.headers['x-correlation-id']
  if (typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim()
  }
  // Generate short ID (8 chars)
  return crypto.randomBytes(4).toString('hex')
}

export const previewImportHandler: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    if (!req.user?.userId) {
      next(new AppError('Missing user in request', 403))
      return
    }

    const file = (req as unknown as { file?: Express.Multer.File }).file
    if (!file) {
      next(new AppError('No file uploaded', 400))
      return
    }

    // Validate file type and size
    try {
      validateFile(file.path, file.size)
    } catch (err) {
      await fs.unlink(file.path).catch(() => { /* ignore */ })
      const message = err instanceof Error ? err.message : 'Invalid file'
      if (message.includes('size exceeds')) {
        next(new AppError(message, 413))
      } else {
        next(new AppError(message, 400))
      }
      return
    }

    const correlationId = getCorrelationId(req)

    try {
      const result = await previewImport(file.path, accountId, req.user.userId, correlationId)
      
      // Clean up temp file
      await fs.unlink(file.path).catch(() => {
        /* ignore */
      })

      res.status(200).json(result)
    } catch (err) {
      // Clean up temp file on error
      await fs.unlink(file.path).catch(() => {
        /* ignore */
      })
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('row count') || message.includes('2000')) {
        next(new AppError(message, 400))
        return
      }
      throw err
    }
  } catch (err) {
    next(err)
  }
}

export const runImportHandler: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    if (!req.user?.userId) {
      next(new AppError('Missing user in request', 403))
      return
    }

    const parsed = runImportBodySchema.safeParse(req.body)
    if (!parsed.success) {
      next(new AppError('Invalid request body', 400))
      return
    }

    const correlationId = getCorrelationId(req)
    const { jobId, options } = parsed.data
    const result = await runImport(jobId, accountId, req.user.userId, options, correlationId)
    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

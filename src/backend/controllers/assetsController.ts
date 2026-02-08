// src/backend/controllers/assetsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { listAssets as serviceListAssets } from '../services/assetsService'

const querySchema = z.object({
  clientId: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().positive().optional()),
  projectId: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().positive().optional()),
  disciplineId: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().positive().optional()),
  subtypeId: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().positive().optional()),
  q: z.string().optional(),
})

export const listAssets: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('Invalid query parameters', 400)
    }

    const filters = {
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      disciplineId: parsed.data.disciplineId,
      subtypeId: parsed.data.subtypeId,
      q: parsed.data.q,
    }
    const list = await serviceListAssets(accountId, filters)
    res.status(200).json(list)
  } catch (error) {
    next(error)
  }
}

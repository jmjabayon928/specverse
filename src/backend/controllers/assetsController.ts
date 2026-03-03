// src/backend/controllers/assetsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { listAssets as serviceListAssets, getAssetById as serviceGetAssetById, getAssetCustomFields as serviceGetAssetCustomFields } from '../services/assetsService'

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
  location: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed
    }),
  system: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed
    }),
  service: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed
    }),
  criticality: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed
    }),
  q: z.string().optional(),
})

const paramsSchema = z.object({
  id: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
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
      location: parsed.data.location,
      system: parsed.data.system,
      service: parsed.data.service,
      criticality: parsed.data.criticality,
      q: parsed.data.q,
    }
    const list = await serviceListAssets(accountId, filters)
    res.status(200).json(list)
  } catch (error) {
    next(error)
  }
}

export const getAssetCustomFields: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsedParams = paramsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      throw new AppError('Invalid asset id', 400)
    }

    const fields = await serviceGetAssetCustomFields(accountId, parsedParams.data.id)
    res.status(200).json(fields)
  } catch (error) {
    next(error)
  }
}

export const getAssetById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsedParams = paramsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      throw new AppError('Invalid asset id', 400)
    }

    const asset = await serviceGetAssetById(accountId, parsedParams.data.id)
    if (asset == null) {
      throw new AppError('Asset not found', 404)
    }

    res.status(200).json(asset)
  } catch (error) {
    next(error)
  }
}

// src/backend/controllers/systemAssetsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { systemBelongsToAccountAndFacility } from '../repositories/schedulesRepository'
import * as systemAssetsRepository from '../repositories/systemAssetsRepository'

const systemAssetsQuerySchema = z.object({
  q: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed
    }),
  status: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed
    }),
  take: z
    .string()
    .optional()
    .transform(s => (s != null && s !== '' ? Number(s) : undefined))
    .pipe(z.number().int().min(1).max(200).optional()),
  skip: z
    .string()
    .optional()
    .transform(s => (s != null && s !== '' ? Number(s) : undefined))
    .pipe(z.number().int().min(0).optional()),
})

const systemAssetsParamsSchema = z.object({
  facilityId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
  systemId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
})

export const listAssetsForSystem: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsedParams = systemAssetsParamsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      throw new AppError('Invalid facility or system id', 400)
    }

    const parsedQuery = systemAssetsQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      throw new AppError('Invalid query parameters', 400)
    }

    // Validate system belongs to facility and account
    const belongs = await systemBelongsToAccountAndFacility(
      parsedParams.data.systemId,
      accountId,
      parsedParams.data.facilityId
    )
    if (!belongs) {
      throw new AppError('System not found', 404)
    }

    // Get system name
    const systemName = await systemAssetsRepository.getSystemNameForSystem(
      accountId,
      parsedParams.data.facilityId,
      parsedParams.data.systemId
    )
    if (systemName == null) {
      throw new AppError('System not found', 404)
    }

    // Validate pagination bounds
    const take = parsedQuery.data.take ?? 50
    if (!Number.isInteger(take) || take < 1 || take > 200) {
      throw new AppError('take must be an integer between 1 and 200', 400)
    }

    const skip = parsedQuery.data.skip ?? 0
    if (!Number.isInteger(skip) || skip < 0) {
      throw new AppError('skip must be a non-negative integer', 400)
    }

    const filters = {
      q: parsedQuery.data.q,
      status: parsedQuery.data.status,
      take,
      skip,
    }

    const result = await systemAssetsRepository.listAssetsForSystemName(
      accountId,
      systemName,
      filters
    )

    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

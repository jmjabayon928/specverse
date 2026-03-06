// src/backend/controllers/facilitiesController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import * as facilitiesService from '../services/facilitiesService'

const listQuerySchema = z.object({
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

const facilityIdParamsSchema = z.object({
  facilityId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
})

const systemsQuerySchema = z.object({
  q: z
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

const systemIdParamsSchema = z.object({
  facilityId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
  systemId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
})

export const listFacilities: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsed = listQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      throw new AppError('Invalid query parameters', 400)
    }

    const take = parsed.data.take ?? 50
    if (!Number.isInteger(take) || take < 1 || take > 200) {
      throw new AppError('take must be an integer between 1 and 200', 400)
    }

    const skip = parsed.data.skip ?? 0
    if (!Number.isInteger(skip) || skip < 0) {
      throw new AppError('skip must be a non-negative integer', 400)
    }

    const filters = {
      q: parsed.data.q,
      status: parsed.data.status,
      take,
      skip,
    }

    const result = await facilitiesService.listFacilities(accountId, filters)
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

export const getFacilityById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsed = facilityIdParamsSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError('Invalid facility id', 400)
    }

    // Verify facility belongs to account
    const belongs = await facilitiesService.facilityBelongsToAccount(
      parsed.data.facilityId,
      accountId
    )
    if (!belongs) {
      throw new AppError('Facility not found', 404)
    }

    const facility = await facilitiesService.getFacilityById(accountId, parsed.data.facilityId)
    if (facility == null) {
      throw new AppError('Facility not found', 404)
    }

    res.status(200).json(facility)
  } catch (error) {
    next(error)
  }
}

export const listSystems: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsedParams = facilityIdParamsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      throw new AppError('Invalid facility id', 400)
    }

    const parsedQuery = systemsQuerySchema.safeParse(req.query)
    if (!parsedQuery.success) {
      throw new AppError('Invalid query parameters', 400)
    }

    // Verify facility belongs to account
    const belongs = await facilitiesService.facilityBelongsToAccount(
      parsedParams.data.facilityId,
      accountId
    )
    if (!belongs) {
      throw new AppError('Facility not found', 404)
    }

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
      take,
      skip,
    }

    const result = await facilitiesService.listSystems(accountId, parsedParams.data.facilityId, filters)
    res.status(200).json(result)
  } catch (error) {
    next(error)
  }
}

export const getSystemById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return

    const parsed = systemIdParamsSchema.safeParse(req.params)
    if (!parsed.success) {
      throw new AppError('Invalid facility or system id', 400)
    }

    // Verify system belongs to facility and account
    const belongs = await facilitiesService.systemBelongsToAccountAndFacility(
      parsed.data.systemId,
      accountId,
      parsed.data.facilityId
    )
    if (!belongs) {
      throw new AppError('System not found', 404)
    }

    const system = await facilitiesService.getSystemById(
      accountId,
      parsed.data.facilityId,
      parsed.data.systemId
    )
    if (system == null) {
      throw new AppError('System not found', 404)
    }

    res.status(200).json({
      systemId: system.systemId,
      systemName: system.systemName,
      facilityId: parsed.data.facilityId,
      status: system.status,
    })
  } catch (error) {
    next(error)
  }
}

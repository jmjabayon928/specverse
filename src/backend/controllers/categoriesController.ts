// src/backend/controllers/categoriesController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listCategories as listCategoriesService,
  getCategoryById as getCategoryByIdService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
  type ListCategoriesParams,
  type ListCategoriesResult,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '../services/categoriesService'

// ----------------------------- Zod Schemas -----------------------------

const categoryCreateSchema = z.object({
  CategoryCode: z
    .string()
    .trim()
    .min(1, 'CategoryCode is required')
    .max(20, 'CategoryCode too long (max 20)'),
  CategoryName: z
    .string()
    .trim()
    .min(1, 'CategoryName is required')
    .max(150, 'CategoryName too long (max 150)'),
})

const categoryUpdateSchema = categoryCreateSchema.partial()

type CategoryCreateBody = z.infer<typeof categoryCreateSchema>
type CategoryUpdateBody = z.infer<typeof categoryUpdateSchema>

// --------------------------- Helper functions --------------------------

const qstr = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }

  return fallback
}

const qint = (value: unknown, fallback: number): number => {
  const asString = qstr(value, String(fallback))
  const parsed = Number.parseInt(asString, 10)

  if (Number.isFinite(parsed)) {
    return parsed
  }

  return fallback
}

const buildUpdatePayload = (body: CategoryUpdateBody): UpdateCategoryInput => {
  const payload: UpdateCategoryInput = {}

  const keys = Object.keys(body) as (keyof CategoryUpdateBody)[]

  for (const key of keys) {
    const castKey = key as keyof UpdateCategoryInput
    const raw = body[castKey]

    if (typeof raw === 'string') {
      payload[castKey] = raw.trim()
    }
  }

  return payload
}

const ensureHasUpdatableFields = (payload: UpdateCategoryInput): void => {
  if (Object.keys(payload).length > 0) {
    return
  }

  throw new AppError('No updatable fields provided', 400)
}

const firstIssueMessage = (result: z.SafeParseError<unknown>): string => {
  const issue = result.error.issues[0]

  if (issue && issue.message) {
    return issue.message
  }

  return 'Invalid category payload'
}

// ----------------------------- List / Get ------------------------------

/** GET /api/backend/settings/categories */
export const listCategories: RequestHandler = async (req, res, next) => {
  try {
    const page = Math.max(qint(req.query.page, 1), 1)
    const pageSize = Math.min(Math.max(qint(req.query.pageSize, 20), 1), 100)
    const search = qstr(req.query.search, '').trim()

    const params: ListCategoriesParams = {
      page,
      pageSize,
      search,
    }

    const result: ListCategoriesResult = await listCategoriesService(params)

    res.status(200).json(result)
  } catch (error) {
    console.error('listCategories error:', error)
    next(new AppError('Failed to fetch categories', 500))
  }
}

/** GET /api/backend/settings/categories/:id */
export const getCategory: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', 400)
    }

    const row = await getCategoryByIdService(id)

    if (!row) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json(row)
  } catch (error) {
    console.error('getCategory error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to fetch category', 500))
  }
}

// ----------------------------- Create ---------------------------------

/** POST /api/backend/settings/categories */
export const createCategory: RequestHandler = async (req, res, next) => {
  try {
    const parsed = categoryCreateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message, 400)
    }

    const body: CategoryCreateBody = parsed.data

    const input: CreateCategoryInput = {
      CategoryCode: body.CategoryCode.trim(),
      CategoryName: body.CategoryName.trim(),
    }

    const newId = await createCategoryService(input)

    res.status(201).json({ CategoryID: newId })
  } catch (error) {
    if (error instanceof Error && error.name === 'CATEGORYCODE_CONFLICT') {
      next(new AppError('CategoryCode already exists', 409))
      return
    }

    console.error('createCategory error:', error)
    next(new AppError('Failed to create category', 500))
  }
}

// ----------------------------- Update ---------------------------------

/** PATCH /api/backend/settings/categories/:id */
export const updateCategory: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', 400)
    }

    const parsed = categoryUpdateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message, 400)
    }

    const payload = buildUpdatePayload(parsed.data)
    ensureHasUpdatableFields(payload)

    const updated = await updateCategoryService(id, payload)

    if (!updated) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    if (error instanceof Error && error.name === 'CATEGORYCODE_CONFLICT') {
      next(new AppError('CategoryCode already exists', 409))
      return
    }

    console.error('updateCategory error:', error)
    next(new AppError('Failed to update category', 500))
  }
}

// ----------------------------- Delete ---------------------------------

/** DELETE /api/backend/settings/categories/:id */
export const deleteCategory: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid id', 400)
    }

    const deleted = await deleteCategoryService(id)

    if (!deleted) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('deleteCategory error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to delete category', 500))
  }
}

import type { Request, NextFunction, RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '@/backend/errors/AppError'
import type { UserSession } from '../../domain/auth/sessionTypes' // Assuming a global errorHandler
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { fetchAssetDocuments, addAssetDocumentLink, removeAssetDocumentLink } from '@/backend/services/assetDocumentsService'

function asUser(req: Request): UserSession | null {
  const maybeUser = req.user as UserSession | undefined
  if (maybeUser == null) {
    return null
  }
  return maybeUser
}

const handleError = (next: NextFunction, err: unknown, fallbackMessage: string): void => {
  if (err instanceof AppError) {
    next(err)
    return
  }

  if (err instanceof z.ZodError) {
    next(new AppError("Invalid request payload", 400))
    return
  }

  if (err instanceof Error && err.message.startsWith("VALIDATION:")) {
    const message = err.message.replace(/^VALIDATION:\s*/, "").trim()
    next(new AppError(message || "Validation failed", 400))
    return
  }

  console.error(fallbackMessage, err)
  next(new AppError(fallbackMessage, 500))
}

const assetIdParamsSchema = z.object({
  assetId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
})

const attachmentIdParamsSchema = z.object({
  assetId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
  attachmentId: z
    .string()
    .transform(s => Number(s))
    .pipe(z.number().int().positive()),
})

const assetDocumentQueryParamsSchema = z.object({
  q: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed.slice(0, 200)
    }),
  take: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().min(1).max(200).optional()),
  skip: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().min(0).optional()),
})

const linkAssetDocumentBodySchema = z.object({
  attachmentId: z.number().int().positive(),
})

export const listAssetDocuments: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = assetIdParamsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      throw new AppError('Invalid asset ID', 400)
    }
    const assetId = parsedParams.data.assetId

    const parsedQuery = assetDocumentQueryParamsSchema.safeParse(req.query)
    if (!parsedQuery.success) {
      throw new AppError('Invalid query parameters', 400)
    }

    const filters = {
      q: parsedQuery.data.q,
      take: parsedQuery.data.take ?? 50,
      skip: parsedQuery.data.skip ?? 0,
    }

    const result = await fetchAssetDocuments({ accountId, assetId, ...filters })
    res.status(200).json(result)
  } catch (err: unknown) {
    handleError(next, err, 'Failed to fetch asset documents')
  }
}

export const linkAssetDocument: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const user = asUser(req)
    const userId = user?.userId
    if (!userId) {
      throw new AppError('Unauthorized', 401)
    }

    const parsedParams = assetIdParamsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      throw new AppError('Invalid asset ID', 400)
    }
    const assetId = parsedParams.data.assetId

    const parsedBody = linkAssetDocumentBodySchema.safeParse(req.body)
    if (!parsedBody.success) {
      throw new AppError('Invalid request body', 400)
    }
    const { attachmentId } = parsedBody.data

    await addAssetDocumentLink({ accountId, assetId, attachmentId, userId })
    res.status(200).json({ message: 'Document linked successfully' })
  } catch (err: unknown) {
    handleError(next, err, 'Failed to link document to asset')
  }
}

export const unlinkAssetDocument: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return

    const parsedParams = attachmentIdParamsSchema.safeParse(req.params)
    if (!parsedParams.success) {
      throw new AppError('Invalid asset ID or attachment ID', 400)
    }
    const { assetId, attachmentId } = parsedParams.data

    await removeAssetDocumentLink({ accountId, assetId, attachmentId })
    res.status(204).end()
  } catch (err: unknown) {
    handleError(next, err, 'Failed to unlink document from asset')
  }
}

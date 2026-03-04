// src/backend/middleware/errorHandler.ts
import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors/AppError'

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // keep the next parameter to satisfy Express' error signature
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = next

  let statusCode = 500
  let message = 'Internal server error'
  let code = 'INTERNAL_SERVER_ERROR'

  const isAppError = err instanceof AppError

  if (isAppError) {
    if (typeof err.statusCode === 'number') {
      statusCode = err.statusCode
    }

    if (typeof err.message === 'string') {
      message = err.message
    }
  } else {
    const candidate = err as { statusCode?: unknown; message?: unknown; type?: string }

    if (typeof candidate.statusCode === 'number') {
      statusCode = candidate.statusCode
      if (typeof candidate.message === 'string') {
        message = candidate.message
      }
    } else if (candidate.type === 'entity.parse.failed') {
      statusCode = 400
      message = 'Invalid JSON body'
    }
  }

  if (statusCode === 400) code = 'BAD_REQUEST'
  if (statusCode === 401) code = 'UNAUTHORIZED'
  if (statusCode === 403) code = 'FORBIDDEN'
  if (statusCode === 404) code = 'NOT_FOUND'

  const isProd = process.env.NODE_ENV === 'production'
  const isClientError = statusCode >= 400 && statusCode < 500

  if (!isProd) {
    if (isClientError) {
      console.warn({
        message,
        statusCode,
        path: typeof req.path === 'string' ? req.path : undefined,
      })
    } else {
      console.error(err)
    }
  }

  // Backwards compatible shape: many clients expect `error`.
  // New structured fields: `message` + `code`. Include payload (e.g. fieldErrors) when present.
  const body: Record<string, unknown> = { error: message, message, code }
  if (isAppError && err.payload != null) {
    Object.assign(body, err.payload)
  }
  if (!isProd) {
    body.name = err instanceof Error ? err.name : 'UnknownError'
    body.stackPreview = err instanceof Error && typeof err.stack === 'string'
      ? err.stack.split('\n').slice(0, 5)
      : []
  }
  res.status(statusCode).json(body)
}

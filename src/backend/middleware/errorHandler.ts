// src/backend/middleware/errorHandler.ts
import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors/AppError'

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // keep the next parameter to satisfy Express' error signature
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = next

  let statusCode = 500
  let message = 'Internal server error'
  let code = 'INTERNAL_SERVER_ERROR'

  if (err instanceof AppError) {
    if (typeof err.statusCode === 'number') {
      statusCode = err.statusCode
    }

    if (typeof err.message === 'string') {
      message = err.message
    }
  }

  if (statusCode === 400) code = 'BAD_REQUEST'
  if (statusCode === 401) code = 'UNAUTHORIZED'
  if (statusCode === 403) code = 'FORBIDDEN'
  if (statusCode === 404) code = 'NOT_FOUND'

  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  }

  // Backwards compatible shape: many clients expect `error`.
  // New structured fields: `message` + `code`. Include payload (e.g. fieldErrors) when present.
  const body: Record<string, unknown> = { error: message, message, code }
  if (err instanceof AppError && err.payload != null) {
    Object.assign(body, err.payload)
  }
  res.status(statusCode).json(body)
}

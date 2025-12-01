// src/backend/middleware/errorHandler.ts

import type { ErrorRequestHandler } from 'express'
import { AppError } from '../errors/AppError'

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = next

  const statusCode =
    err instanceof AppError && typeof err.statusCode === 'number'
      ? err.statusCode
      : 500

  const message =
    err instanceof AppError && typeof err.message === 'string'
      ? err.message
      : 'Internal server error'

  if (process.env.NODE_ENV !== 'production') {
    console.error(err)
  }

  res.status(statusCode).json({ error: message })
}


// src/backend/errors/AppError.ts

// Lightweight application error with HTTP status and an "operational" flag.
// Use this for errors that should be sent to the client in a controlled way.
// Optional payload (e.g. fieldErrors) is included in the JSON response.
export class AppError extends Error {
  statusCode: number
  isOperational: boolean
  payload?: Record<string, unknown>

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    payload?: Record<string, unknown>
  ) {
    super(message)

    this.statusCode = statusCode
    this.isOperational = isOperational
    this.payload = payload

    Object.setPrototypeOf(this, AppError.prototype)
  }
}

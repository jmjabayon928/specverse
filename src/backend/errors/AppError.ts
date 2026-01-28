// src/backend/errors/AppError.ts

// Lightweight application error with HTTP status and an "operational" flag.
// Use this for errors that should be sent to the client in a controlled way.
export class AppError extends Error {
  statusCode: number
  isOperational: boolean

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message)

    this.statusCode = statusCode
    this.isOperational = isOperational

    Object.setPrototypeOf(this, AppError.prototype)
  }
}

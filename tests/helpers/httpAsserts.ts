/**
 * Pure assertion helpers for common HTTP response status codes.
 * Supports both supertest Response objects (status/statusCode) and minimal response shapes.
 */
import { expect } from '@jest/globals'

type HttpResponse = {
  status?: number
  statusCode?: number
  body?: unknown
  text?: string
}

function getStatus(res: HttpResponse): number {
  return res.status ?? res.statusCode ?? 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractMessage(res: HttpResponse): string {
  if (isRecord(res.body)) {
    if (typeof res.body.message === 'string') {
      return res.body.message
    }
    if (typeof res.body.error === 'string') {
      return res.body.error
    }
  }
  if (typeof res.text === 'string') {
    return res.text
  }
  return ''
}

function matchesPattern(text: string, pattern: RegExp | string): boolean {
  if (typeof pattern === 'string') {
    return text.includes(pattern)
  }
  return pattern.test(text)
}

/**
 * Asserts that the response has status 401 (Unauthenticated).
 */
export function assertUnauthenticated(res: HttpResponse): void {
  expect(getStatus(res)).toBe(401)
}

/**
 * Asserts that the response has status 403 (Forbidden).
 * Optionally validates that the error message matches a pattern.
 */
export function assertForbidden(res: HttpResponse, messagePattern?: RegExp | string): void {
  expect(getStatus(res)).toBe(403)
  if (messagePattern !== undefined) {
    const message = extractMessage(res)
    expect(matchesPattern(message, messagePattern)).toBe(true)
  }
}

/**
 * Asserts that the response has status 404 (Not Found).
 * Optionally validates that the error message matches a pattern.
 */
export function assertNotFound(res: HttpResponse, messagePattern?: RegExp | string): void {
  expect(getStatus(res)).toBe(404)
  if (messagePattern !== undefined) {
    const message = extractMessage(res)
    expect(matchesPattern(message, messagePattern)).toBe(true)
  }
}

/**
 * Asserts that the response has status 400 (Bad Request / Validation Error).
 * Optionally validates that the error message matches a pattern (typically a field name).
 */
export function assertValidationError(res: HttpResponse, fieldPattern?: RegExp | string): void {
  expect(getStatus(res)).toBe(400)
  if (fieldPattern !== undefined) {
    const message = extractMessage(res)
    expect(matchesPattern(message, fieldPattern)).toBe(true)
  }
}

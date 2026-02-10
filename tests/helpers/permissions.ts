/**
 * Deterministic helpers for expressing permission expectations in tests.
 * These helpers encode "who is allowed" vs "who is forbidden" explicitly.
 * Route-agnostic: accepts functions that execute requests, not route strings.
 */
import { expect } from '@jest/globals'
import { assertForbidden } from './httpAsserts'

type HttpResponse = {
  status?: number
  statusCode?: number
  body?: unknown
  text?: string
}

function getStatus(res: HttpResponse): number {
  return res.status ?? res.statusCode ?? 0
}

export type RequestFn = () => Promise<unknown>

/**
 * Asserts that an action requires owner access.
 * Calls allowed() and asserts success (200 by default).
 * Calls forbidden() and asserts 403 Forbidden.
 */
export async function expectOwnerOnly(args: {
  allowed: RequestFn
  forbidden: RequestFn
  allowedStatus?: number
}): Promise<void> {
  const { allowed, forbidden, allowedStatus = 200 } = args

  const allowedRes = (await allowed()) as HttpResponse
  expect(getStatus(allowedRes)).toBe(allowedStatus)

  const forbiddenRes = (await forbidden()) as HttpResponse
  assertForbidden(forbiddenRes)
}

/**
 * Asserts that an action requires admin role.
 * Calls allowed() and asserts success (200 by default).
 * Calls forbidden() and asserts 403 Forbidden.
 */
export async function expectAdminOnly(args: {
  allowed: RequestFn
  forbidden: RequestFn
  allowedStatus?: number
}): Promise<void> {
  const { allowed, forbidden, allowedStatus = 200 } = args

  const allowedRes = (await allowed()) as HttpResponse
  expect(getStatus(allowedRes)).toBe(allowedStatus)

  const forbiddenRes = (await forbidden()) as HttpResponse
  assertForbidden(forbiddenRes)
}

/**
 * Asserts that an action requires a specific permission.
 * Calls allowed() and asserts success (200 by default).
 * Calls forbidden() and asserts 403 Forbidden.
 */
export async function expectPermissionOnly(args: {
  allowed: RequestFn
  forbidden: RequestFn
  allowedStatus?: number
}): Promise<void> {
  const { allowed, forbidden, allowedStatus = 200 } = args

  const allowedRes = (await allowed()) as HttpResponse
  expect(getStatus(allowedRes)).toBe(allowedStatus)

  const forbiddenRes = (await forbidden()) as HttpResponse
  assertForbidden(forbiddenRes)
}

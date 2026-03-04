import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '@/backend/app'
import { patchChecklistRunEntry } from '@/backend/services/checklistsService'
import type { ChecklistRunEntryPatchInput } from '@/domain/checklists/checklistTypes'

interface AuthenticatedUser {
  accountId?: number
  userId?: number
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser
}

jest.mock('@/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('@/backend/middleware/authMiddleware') as {
    PERMISSIONS?: Record<string, string>
    [key: string]: unknown
  }

  const verifyToken: RequestHandler = (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    const authReq = req as AuthenticatedRequest
    authReq.user = {
      accountId: 123,
      userId: 456,
    }
    next()
  }

  const requirePermission = (_permission: string): RequestHandler => {
    const handler: RequestHandler = (_req: Request, _res: Response, next: NextFunction): void => {
      next()
    }
    return handler
  }

  const mergedPermissions: Record<string, string> = {
    ...(actual.PERMISSIONS ?? {}),
    CHECKLISTS_RUN_EXECUTE: 'CHECKLISTS_RUN_EXECUTE',
  }

  return {
    ...actual,
    PERMISSIONS: mergedPermissions,
    verifyToken,
    requirePermission,
  }
})

jest.mock('@/backend/services/checklistsService', () => ({
  patchChecklistRunEntry: jest.fn(),
}))

const patchChecklistRunEntryMock = patchChecklistRunEntry as jest.MockedFunction<
  typeof patchChecklistRunEntry
>

describe('PATCH /api/backend/checklists/run-entries/:runEntryId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('patches run entry with valid payload', async () => {
    patchChecklistRunEntryMock.mockResolvedValueOnce()

    const runEntryId = 777

    const payload: ChecklistRunEntryPatchInput = {
      result: 'PASS',
      notes: 'All good',
      measuredValue: '12.3',
      uom: 'V',
      expectedRowVersionBase64: 'ZXhwZWN0ZWQ=',
    }

    const response = await request(app)
      .patch(`/api/backend/checklists/run-entries/${runEntryId}`)
      .send(payload)
      .expect(200)

    expect(patchChecklistRunEntryMock).toHaveBeenCalledTimes(1)

    const [accountIdArg, userIdArg, runEntryIdArg, inputArg] = patchChecklistRunEntryMock.mock
      .calls[0] as [number, number, number, ChecklistRunEntryPatchInput]

    expect(accountIdArg).toBe(123)
    expect(userIdArg).toBe(456)
    expect(runEntryIdArg).toBe(runEntryId)
    expect(inputArg).toEqual(payload)

    expect(response.body).toEqual({ ok: true })
  })

  it('returns 400 for invalid result', async () => {
    const runEntryId = 777

    const response = await request(app)
      .patch(`/api/backend/checklists/run-entries/${runEntryId}`)
      .send({ result: 'BAD', expectedRowVersionBase64: 'ZXhwZWN0ZWQ=' })
      .expect(400)

    expect(patchChecklistRunEntryMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')
  })

  it('returns 409 when service signals concurrency conflict', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    patchChecklistRunEntryMock.mockRejectedValueOnce({
      statusCode: 409,
      message: 'Checklist run entry was modified by another user. Refresh and try again.',
      isOperational: true,
    })

    const runEntryId = 777

    const response = await request(app)
      .patch(`/api/backend/checklists/run-entries/${runEntryId}`)
      .send({
        result: 'PASS',
        expectedRowVersionBase64: 'ZXhwZWN0ZWQ=',
      })
      .expect(409)

    expect(typeof response.body).toBe('object')

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })
})


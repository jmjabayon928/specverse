import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '@/backend/app'
import type { CreateChecklistRunResult } from '@/domain/checklists/checklistTypes'
import { createChecklistRun } from '@/backend/services/checklistsService'

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
    CHECKLISTS_RUN_CREATE: 'CHECKLISTS_RUN_CREATE',
  }

  return {
    ...actual,
    PERMISSIONS: mergedPermissions,
    verifyToken,
    requirePermission,
  }
})

jest.mock('@/backend/services/checklistsService', () => ({
  createChecklistRun: jest.fn(),
}))

const createChecklistRunMock = createChecklistRun as jest.MockedFunction<typeof createChecklistRun>

describe('POST /api/backend/checklists/run', () => {
  it('creates a checklist run and returns result', async () => {
    const expectedResult: CreateChecklistRunResult = {
      checklistRunId: 42,
      entryCount: 3,
    }

    createChecklistRunMock.mockResolvedValueOnce(expectedResult)

    const payload = {
      checklistTemplateId: 10,
      runName: 'My checklist run',
      notes: 'Some notes',
      projectId: 1,
      facilityId: 2,
      systemId: 3,
      assetId: 4,
    }

    const response = await request(app)
      .post('/api/backend/checklists/run')
      .send(payload)
      .expect(200)

    expect(createChecklistRunMock).toHaveBeenCalledTimes(1)

    const callArgs = createChecklistRunMock.mock.calls[0]

    const accountIdArg = callArgs[0]
    const userIdArg = callArgs[1]
    const inputArg = callArgs[2]

    expect(accountIdArg).toBe(123)
    expect(userIdArg).toBe(456)

    expect(inputArg).toMatchObject({
      checklistTemplateId: payload.checklistTemplateId,
      runName: payload.runName,
      notes: payload.notes,
      projectId: payload.projectId,
      facilityId: payload.facilityId,
      systemId: payload.systemId,
      assetId: payload.assetId,
    })

    expect(typeof response.body.checklistRunId).toBe('number')
    expect(typeof response.body.entryCount).toBe('number')
    expect(response.body.checklistRunId).toBe(expectedResult.checklistRunId)
    expect(response.body.entryCount).toBe(expectedResult.entryCount)
  })
})


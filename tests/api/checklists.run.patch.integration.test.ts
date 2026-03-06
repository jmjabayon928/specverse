import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '@/backend/app'
import { patchChecklistRun } from '@/backend/services/checklistsService'
import type { ChecklistRunPatchInput } from '@/domain/checklists/checklistTypes'

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
    CHECKLISTS_RUN_UPDATE: 'CHECKLISTS_RUN_UPDATE',
  }

  return {
    ...actual,
    PERMISSIONS: mergedPermissions,
    verifyToken,
    requirePermission,
  }
})

jest.mock('@/backend/services/checklistsService', () => ({
  patchChecklistRun: jest.fn(),
}))

const patchChecklistRunMock = patchChecklistRun as jest.MockedFunction<typeof patchChecklistRun>

describe('PATCH /api/backend/checklists/runs/:runId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('patches run status to CANCELLED for IN_PROGRESS run', async () => {
    patchChecklistRunMock.mockResolvedValueOnce()

    const runId = 42

    const payload: ChecklistRunPatchInput = {
      status: 'CANCELLED',
    }

    const response = await request(app)
      .patch(`/api/backend/checklists/runs/${runId}`)
      .send(payload)
      .expect(200)

    expect(patchChecklistRunMock).toHaveBeenCalledTimes(1)
    const [accountIdArg, userIdArg, runIdArg, inputArg] = patchChecklistRunMock.mock
      .calls[0] as [number, number, number, ChecklistRunPatchInput]

    expect(accountIdArg).toBe(123)
    expect(userIdArg).toBe(456)
    expect(runIdArg).toBe(runId)
    expect(inputArg).toEqual(payload)

    expect(response.body).toEqual({ ok: true })
  })

  it('returns 400 for invalid runId', async () => {
    const response = await request(app)
      .patch('/api/backend/checklists/runs/invalid')
      .send({ status: 'CANCELLED' })
      .expect(400)

    expect(patchChecklistRunMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')
  })

  it('returns 400 for invalid status value', async () => {
    const response = await request(app)
      .patch('/api/backend/checklists/runs/42')
      .send({ status: 'INVALID_STATUS' })
      .expect(400)

    expect(patchChecklistRunMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')
  })

  it('returns 400 for empty request body', async () => {
    const response = await request(app)
      .patch('/api/backend/checklists/runs/42')
      .send({})
      .expect(400)

    expect(patchChecklistRunMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')
  })

  it('returns 404 when run not found', async () => {
    patchChecklistRunMock.mockRejectedValueOnce({
      statusCode: 404,
      message: 'Checklist run not found',
      isOperational: true,
    })

    const response = await request(app)
      .patch('/api/backend/checklists/runs/999')
      .send({ status: 'CANCELLED' })
      .expect(404)

    expect(patchChecklistRunMock).toHaveBeenCalledTimes(1)
    expect(typeof response.body).toBe('object')
  })

  it('returns 400 when trying to cancel non-IN_PROGRESS run', async () => {
    patchChecklistRunMock.mockRejectedValueOnce({
      statusCode: 400,
      message: 'Can only cancel IN_PROGRESS checklist runs',
      isOperational: true,
    })

    const response = await request(app)
      .patch('/api/backend/checklists/runs/42')
      .send({ status: 'CANCELLED' })
      .expect(400)

    expect(patchChecklistRunMock).toHaveBeenCalledTimes(1)
    expect(typeof response.body).toBe('object')
  })
})

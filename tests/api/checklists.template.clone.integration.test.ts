import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '@/backend/app'
import { cloneChecklistTemplate } from '@/backend/services/checklistsService'
import type { ChecklistTemplateCloneResult } from '@/domain/checklists/checklistTypes'

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
    CHECKLISTS_TEMPLATE_CLONE: 'CHECKLISTS_TEMPLATE_CLONE',
  }

  return {
    ...actual,
    PERMISSIONS: mergedPermissions,
    verifyToken,
    requirePermission,
  }
})

jest.mock('@/backend/services/checklistsService', () => ({
  cloneChecklistTemplate: jest.fn(),
}))

const cloneChecklistTemplateMock = cloneChecklistTemplate as jest.MockedFunction<
  typeof cloneChecklistTemplate
>

describe('POST /api/backend/checklists/templates/:id/clone', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clones template and returns new template ID with version number', async () => {
    const templateId = 10

    const expectedResult: ChecklistTemplateCloneResult = {
      checklistTemplateId: 20,
      versionNumber: 2,
      entryCount: 5,
    }

    cloneChecklistTemplateMock.mockResolvedValueOnce(expectedResult)

    const response = await request(app)
      .post(`/api/backend/checklists/templates/${templateId}/clone`)
      .expect(200)

    expect(cloneChecklistTemplateMock).toHaveBeenCalledTimes(1)
    const [accountIdArg, userIdArg, templateIdArg] = cloneChecklistTemplateMock.mock
      .calls[0] as [number, number, number]

    expect(accountIdArg).toBe(123)
    expect(userIdArg).toBe(456)
    expect(templateIdArg).toBe(templateId)

    expect(response.body).toEqual(expectedResult)
  })

  it('returns 400 for invalid template id', async () => {
    const response = await request(app)
      .post('/api/backend/checklists/templates/invalid/clone')
      .expect(400)

    expect(cloneChecklistTemplateMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')
  })

  it('returns 404 when template not found', async () => {
    cloneChecklistTemplateMock.mockRejectedValueOnce({
      statusCode: 404,
      message: 'Checklist template not found',
      isOperational: true,
    })

    const response = await request(app)
      .post('/api/backend/checklists/templates/999/clone')
      .expect(404)

    expect(cloneChecklistTemplateMock).toHaveBeenCalledTimes(1)
    expect(typeof response.body).toBe('object')
  })
})

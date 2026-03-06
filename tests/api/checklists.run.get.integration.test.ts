import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '@/backend/app'
import { getChecklistRun } from '@/backend/services/checklistsService'
import type { ChecklistRunDTO, ChecklistRunPagination } from '@/domain/checklists/checklistTypes'

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
    CHECKLISTS_RUN_VIEW: 'CHECKLISTS_RUN_VIEW',
  }

  return {
    ...actual,
    PERMISSIONS: mergedPermissions,
    verifyToken,
    requirePermission,
  }
})

jest.mock('@/backend/services/checklistsService', () => ({
  getChecklistRun: jest.fn(),
}))

const getChecklistRunMock = getChecklistRun as jest.MockedFunction<typeof getChecklistRun>

describe('GET /api/backend/checklists/runs/:runId', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns checklist run DTO from service with pagination and evidence shaping options', async () => {
    const runId = 42

    const dto: ChecklistRunDTO = {
      runId,
      checklistTemplateId: 10,
      checklistTemplateVersionNumber: 2,
      runName: 'My run',
      notes: null,
      projectId: null,
      facilityId: null,
      systemId: null,
      assetId: null,
      status: 'DRAFT',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      completedAt: null,
      entries: [
        {
          runEntryId: 1,
          templateEntryId: 100,
          sortOrder: 1,
          result: 'PENDING',
          notes: null,
          measuredValue: null,
          uom: null,
          evidenceAttachmentIds: [5],
          evidenceAttachments: [
            {
              attachmentId: 5,
              originalName: 'stored-file',
              contentType: 'application/pdf',
              fileSizeBytes: 1234,
              uploadedAt: '2024-01-01T00:00:00.000Z',
              uploadedBy: {
                userId: 7,
                firstName: 'Jane',
                lastName: 'Doe',
                email: 'jane@example.com',
              },
            },
          ],
          rowVersionBase64: 'dmVyc2lvbg==',
        },
      ],
      totalEntries: 1,
      completedEntries: 0,
      pendingEntries: 1,
      passEntries: 0,
      failEntries: 0,
      naEntries: 0,
      completionPercentage: 0,
    }

    const pagination: ChecklistRunPagination = {
      page: 2,
      pageSize: 10,
      totalEntries: 100,
    }

    const responsePayload = {
      ...dto,
      pagination,
    }

    getChecklistRunMock.mockResolvedValueOnce(responsePayload)

    const response = await request(app)
      .get(`/api/backend/checklists/runs/${runId}`)
      .query({ page: '2', pageSize: '10', evidence: 'ids' })
      .expect(200)

    expect(getChecklistRunMock).toHaveBeenCalledTimes(1)
    const [accountIdArg, runIdArg, optionsArg] = getChecklistRunMock.mock
      .calls[0] as [number, number, { page: number; pageSize: number; evidenceMode: string }]

    expect(accountIdArg).toBe(123)
    expect(runIdArg).toBe(runId)
    expect(optionsArg).toEqual({
      page: 2,
      pageSize: 10,
      evidenceMode: 'ids',
    })

    expect(response.body).toEqual(responsePayload)
  })
})


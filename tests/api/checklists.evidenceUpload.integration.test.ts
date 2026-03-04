import request from 'supertest'
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import app from '@/backend/app'
import {
  uploadChecklistRunEntryEvidence,
  type ChecklistEvidenceFileMeta,
} from '@/backend/services/checklistsService'

interface AuthenticatedUser {
  accountId?: number
  userId?: number
}

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser
}

interface FileLike {
  originalname: string
  filename: string
  mimetype: string
  size: number
  path: string
}

interface RequestWithFile extends AuthenticatedRequest {
  file?: FileLike
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
    CHECKLISTS_EVIDENCE_UPLOAD: 'CHECKLISTS_EVIDENCE_UPLOAD',
  }

  return {
    ...actual,
    PERMISSIONS: mergedPermissions,
    verifyToken,
    requirePermission,
  }
})

jest.mock('@/backend/utils/attachmentUpload', () => {
  const uploadAttachment = {
    single:
      (_field: string): RequestHandler =>
      (req: Request, _res: Response, next: NextFunction): void => {
        const headerValue = req.headers['x-test-no-file']
        const shouldAttachFile =
          typeof headerValue !== 'string' || headerValue.trim().length === 0

        if (shouldAttachFile) {
          const reqWithFile = req as RequestWithFile
          reqWithFile.file = {
            originalname: 'evidence.pdf',
            filename: 'stored-evidence.pdf',
            mimetype: 'application/pdf',
            size: 1234,
            path: '/tmp/stored-evidence.pdf',
          }
        }

        next()
      },
  }

  return { uploadAttachment }
})

jest.mock('@/backend/services/checklistsService', () => ({
  uploadChecklistRunEntryEvidence: jest.fn(),
}))

const uploadEvidenceMock = uploadChecklistRunEntryEvidence as jest.MockedFunction<
  typeof uploadChecklistRunEntryEvidence
>

describe('POST /api/backend/checklists/run-entries/:runEntryId/evidence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uploads evidence and returns attachmentId', async () => {
    const expectedResult = {
      attachmentId: 999,
      attachment: {
        attachmentId: 999,
        originalName: 'stored-evidence.pdf',
        contentType: 'application/pdf',
        fileSizeBytes: 1234,
        uploadedAt: '2024-01-01T00:00:00.000Z',
        uploadedBy: {
          userId: 456,
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane@example.com',
        },
      },
    }

    uploadEvidenceMock.mockResolvedValueOnce(expectedResult)

    const runEntryId = 321

    const response = await request(app)
      .post(`/api/backend/checklists/run-entries/${runEntryId}/evidence`)
      .set('Content-Type', 'multipart/form-data')
      .expect(200)

    expect(uploadEvidenceMock).toHaveBeenCalledTimes(1)

    const [accountIdArg, userIdArg, runEntryIdArg, fileMetaArg] = uploadEvidenceMock.mock
      .calls[0] as [number, number, number, ChecklistEvidenceFileMeta]

    expect(accountIdArg).toBe(123)
    expect(userIdArg).toBe(456)
    expect(runEntryIdArg).toBe(runEntryId)

    expect(fileMetaArg).toMatchObject({
      originalName: 'evidence.pdf',
      storedName: 'stored-evidence.pdf',
      contentType: 'application/pdf',
      fileSizeBytes: 1234,
      storageProvider: 'local',
      storagePath: '/tmp/stored-evidence.pdf',
      sha256: null,
    })

    expect(response.body).toEqual(expectedResult)
  })

  it('returns 400 when file is missing', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const runEntryId = 321

    const response = await request(app)
      .post(`/api/backend/checklists/run-entries/${runEntryId}/evidence`)
      .set('x-test-no-file', '1')
      .expect(400)

    expect(uploadEvidenceMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')

    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })
})


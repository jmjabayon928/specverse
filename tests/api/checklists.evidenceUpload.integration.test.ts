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
  buffer: Buffer
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

    const headerValue = req.headers['x-test-account-id']
    let accountId: number | undefined
    if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
      const parsed = Number.parseInt(headerValue, 10)
      if (Number.isFinite(parsed)) {
        accountId = parsed
      }
    }

    authReq.user = {
      accountId: accountId ?? 123,
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
        const noFileHeader = req.headers['x-test-no-file']
        const shouldAttachFile =
          typeof noFileHeader !== 'string' || noFileHeader.trim().length === 0

        if (shouldAttachFile) {
          const mimetypeHeader = req.headers['x-test-mimetype']
          const sizeHeader = req.headers['x-test-size']
          const badSignatureHeader = req.headers['x-test-bad-signature']

          const mimetype =
            typeof mimetypeHeader === 'string' && mimetypeHeader.trim().length > 0
              ? mimetypeHeader
              : 'application/pdf'

          let size = 1234
          if (typeof sizeHeader === 'string' && sizeHeader.trim().length > 0) {
            const parsed = Number.parseInt(sizeHeader, 10)
            if (Number.isFinite(parsed) && parsed > 0) {
              size = parsed
            }
          }

          let buffer: Buffer
          const forceBadSignature =
            typeof badSignatureHeader === 'string' && badSignatureHeader.trim().length > 0

          if (forceBadSignature) {
            buffer = Buffer.from('hello world', 'utf8')
          } else if (mimetype === 'application/pdf') {
            buffer = Buffer.from('%PDF-1.4\n', 'ascii')
          } else if (mimetype === 'image/jpeg') {
            buffer = Buffer.from([0xff, 0xd8, 0xff, 0xdb])
          } else if (mimetype === 'image/png') {
            buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          } else if (mimetype === 'image/webp') {
            const arr = Buffer.alloc(12)
            arr.write('RIFF', 0, 'ascii')
            arr.write('WEBP', 8, 'ascii')
            buffer = arr
          } else {
            buffer = Buffer.from('plain text', 'utf8')
          }

          const reqWithFile = req as RequestWithFile
          reqWithFile.file = {
            originalname: 'evidence.pdf',
            filename: 'stored-evidence.pdf',
            mimetype,
            size,
            path: '/tmp/stored-evidence.pdf',
            buffer,
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

  it('returns 415 for unsupported mimetype', async () => {
    const runEntryId = 321

    const response = await request(app)
      .post(`/api/backend/checklists/run-entries/${runEntryId}/evidence`)
      .set('x-test-mimetype', 'text/plain')
      .expect(415)

    expect(uploadEvidenceMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')
  })

  it('returns 413 when file exceeds size limit', async () => {
    const previousEnv = process.env.CHECKLIST_EVIDENCE_MAX_BYTES
    process.env.CHECKLIST_EVIDENCE_MAX_BYTES = '10'

    const runEntryId = 321

    const response = await request(app)
      .post(`/api/backend/checklists/run-entries/${runEntryId}/evidence`)
      .set('x-test-size', '20')
      .expect(413)

    expect(uploadEvidenceMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')

    if (previousEnv === undefined) {
      delete process.env.CHECKLIST_EVIDENCE_MAX_BYTES
    } else {
      process.env.CHECKLIST_EVIDENCE_MAX_BYTES = previousEnv
    }
  })

  it('returns 429 when exceeding per-account rate limit', async () => {
    const previousLimit = process.env.CHECKLIST_EVIDENCE_RL_LIMIT
    const previousWindow = process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC

    process.env.CHECKLIST_EVIDENCE_RL_LIMIT = '1'
    process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC = '60'

    const runEntryId = 321

    await request(app)
      .post(`/api/backend/checklists/run-entries/${runEntryId}/evidence`)
      .set('Content-Type', 'multipart/form-data')
      .set('x-test-account-id', '999')
      .expect(200)

    const secondResponse = await request(app)
      .post(`/api/backend/checklists/run-entries/${runEntryId}/evidence`)
      .set('Content-Type', 'multipart/form-data')
      .set('x-test-account-id', '999')
      .expect(429)

    expect(uploadEvidenceMock).toHaveBeenCalledTimes(1)
    expect(typeof secondResponse.body).toBe('object')
    expect(secondResponse.headers['retry-after']).toBeDefined()

    if (previousLimit === undefined) {
      delete process.env.CHECKLIST_EVIDENCE_RL_LIMIT
    } else {
      process.env.CHECKLIST_EVIDENCE_RL_LIMIT = previousLimit
    }

    if (previousWindow === undefined) {
      delete process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC
    } else {
      process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC = previousWindow
    }
  })

  it('returns 415 when mimetype is allowed but signature is invalid', async () => {
    const previousLimit = process.env.CHECKLIST_EVIDENCE_RL_LIMIT
    const previousWindow = process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC

    process.env.CHECKLIST_EVIDENCE_RL_LIMIT = '100'
    process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC = '60'

    const runEntryId = 321

    const response = await request(app)
      .post(`/api/backend/checklists/run-entries/${runEntryId}/evidence`)
      .set('x-test-mimetype', 'application/pdf')
      .set('x-test-bad-signature', '1')
      .expect(415)

    expect(uploadEvidenceMock).not.toHaveBeenCalled()
    expect(typeof response.body).toBe('object')

    if (previousLimit === undefined) {
      delete process.env.CHECKLIST_EVIDENCE_RL_LIMIT
    } else {
      process.env.CHECKLIST_EVIDENCE_RL_LIMIT = previousLimit
    }

    if (previousWindow === undefined) {
      delete process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC
    } else {
      process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC = previousWindow
    }
  })
})


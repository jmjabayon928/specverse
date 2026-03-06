import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { promises as fs } from 'fs'
import { AppError } from '@/backend/errors/AppError'
import {
  cloneChecklistTemplate,
  createChecklistRun,
  getChecklistRun,
  patchChecklistRun,
  patchChecklistRunEntry,
  uploadChecklistRunEntryEvidence,
} from '@/backend/services/checklistsService'
import type { ChecklistEvidenceFileMeta, ChecklistRunQueryOptions } from '@/backend/services/checklistsService'
import type {
  ChecklistRunEntryPatchInput,
  ChecklistRunEntryResult,
  ChecklistRunPatchInput,
  ChecklistRunStatus,
  CreateChecklistRunInput,
  EvidenceMode,
} from '@/domain/checklists/checklistTypes'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  return true
}

const isNumber = (value: unknown): value is number => {
  if (typeof value !== 'number') {
    return false
  }

  if (!Number.isFinite(value)) {
    return false
  }

  return true
}

const isOptionalNumber = (value: unknown): value is number | undefined => {
  if (value === undefined || value === null) {
    return true
  }

  return isNumber(value)
}

const isStringOrNull = (value: unknown): value is string | null | undefined => {
  if (value === undefined) {
    return true
  }

  if (value === null) {
    return true
  }

  return typeof value === 'string'
}

const isValidRunEntryResult = (value: unknown): value is ChecklistRunEntryResult => {
  if (typeof value !== 'string') {
    return false
  }

  return value === 'PENDING' || value === 'PASS' || value === 'FAIL' || value === 'NA'
}

const getAuthContext = (req: Request): { accountId: number; userId: number } => {
  const maybeUser = (req as Request & { user?: unknown }).user

  if (maybeUser === undefined || maybeUser === null) {
    throw new AppError('Unauthorized', 401)
  }

  if (typeof maybeUser !== 'object') {
    throw new AppError('Unauthorized', 401)
  }

  const candidate = maybeUser as { accountId?: unknown; userId?: unknown }
  const { accountId, userId } = candidate

  if (!isNumber(accountId) || !isNumber(userId)) {
    throw new AppError('Unauthorized', 401)
  }

  return { accountId, userId }
}

const getUploadedFile = (req: Request): Express.Multer.File | undefined => {
  const maybeFile = (req as Request & { file?: unknown }).file

  if (maybeFile === undefined || maybeFile === null) {
    return undefined
  }

  if (typeof maybeFile !== 'object') {
    return undefined
  }

  const file = maybeFile as Partial<Express.Multer.File>

  if (
    typeof file.originalname !== 'string' ||
    typeof file.filename !== 'string' ||
    typeof file.mimetype !== 'string' ||
    typeof file.size !== 'number' ||
    typeof file.path !== 'string'
  ) {
    return undefined
  }

  return maybeFile as Express.Multer.File
}

const readFilePrefix = async (file: Express.Multer.File, maxBytes: number): Promise<Buffer> => {
  const prefixLength = Math.min(12, maxBytes)

  if (Buffer.isBuffer((file as { buffer?: unknown }).buffer)) {
    const buf = (file as { buffer: Buffer }).buffer
    return buf.subarray(0, Math.min(buf.length, prefixLength))
  }

  if (typeof file.path === 'string' && file.path.length > 0) {
    const handle = await fs.open(file.path, 'r')
    try {
      const buf = Buffer.alloc(prefixLength)
      const { bytesRead } = await handle.read(buf, 0, prefixLength, 0)
      return buf.subarray(0, bytesRead)
    } finally {
      await handle.close()
    }
  }

  return Buffer.alloc(0)
}

const hasPdfSignature = (buf: Buffer): boolean => {
  if (buf.length < 5) {
    return false
  }

  return buf.subarray(0, 5).toString('ascii') === '%PDF-'
}

const hasJpegSignature = (buf: Buffer): boolean => {
  if (buf.length < 3) {
    return false
  }

  return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}

const hasPngSignature = (buf: Buffer): boolean => {
  const expected = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (buf.length < expected.length) {
    return false
  }

  for (let i = 0; i < expected.length; i += 1) {
    if (buf[i] !== expected[i]!) {
      return false
    }
  }

  return true
}

const hasWebpSignature = (buf: Buffer): boolean => {
  if (buf.length < 12) {
    return false
  }

  const riff = buf.subarray(0, 4).toString('ascii')
  const webp = buf.subarray(8, 12).toString('ascii')

  return riff === 'RIFF' && webp === 'WEBP'
}

const validateEvidenceFileSignature = async (
  file: Express.Multer.File,
  maxBytes: number,
): Promise<void> => {
  const prefix = await readFilePrefix(file, maxBytes)

  if (file.mimetype === 'application/pdf') {
    if (!hasPdfSignature(prefix)) {
      throw new AppError('Unsupported file type', 415)
    }
    return
  }

  if (file.mimetype === 'image/jpeg') {
    if (!hasJpegSignature(prefix)) {
      throw new AppError('Unsupported file type', 415)
    }
    return
  }

  if (file.mimetype === 'image/png') {
    if (!hasPngSignature(prefix)) {
      throw new AppError('Unsupported file type', 415)
    }
    return
  }

  if (file.mimetype === 'image/webp') {
    if (!hasWebpSignature(prefix)) {
      throw new AppError('Unsupported file type', 415)
    }
    return
  }
}

export const createChecklistRunHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountId, userId } = getAuthContext(req)

    const body = req.body as unknown

    if (!isRecord(body)) {
      throw new AppError('Invalid request body', 400)
    }

    const {
      checklistTemplateId,
      runName,
      notes,
      projectId,
      facilityId,
      systemId,
      assetId,
    } = body

    if (!isNumber(checklistTemplateId)) {
      throw new AppError('checklistTemplateId must be a number', 400)
    }

    if (typeof runName !== 'string' || runName.trim().length === 0) {
      throw new AppError('runName is required', 400)
    }

    if (!isOptionalNumber(projectId)) {
      throw new AppError('projectId must be a number', 400)
    }

    if (!isOptionalNumber(facilityId)) {
      throw new AppError('facilityId must be a number', 400)
    }

    if (!isOptionalNumber(systemId)) {
      throw new AppError('systemId must be a number', 400)
    }

    if (!isOptionalNumber(assetId)) {
      throw new AppError('assetId must be a number', 400)
    }

    const input: CreateChecklistRunInput = {
      checklistTemplateId,
      runName: runName.trim(),
    }

    if (typeof notes === 'string' && notes.trim().length > 0) {
      input.notes = notes
    }

    if (isNumber(projectId)) {
      input.projectId = projectId
    }

    if (isNumber(facilityId)) {
      input.facilityId = facilityId
    }

    if (isNumber(systemId)) {
      input.systemId = systemId
    }

    if (isNumber(assetId)) {
      input.assetId = assetId
    }

    const result = await createChecklistRun(accountId, userId, input)

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const uploadChecklistEvidenceHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountId, userId } = getAuthContext(req)

    const { runEntryId } = req.params
    const runEntryIdNumber = Number(runEntryId)

    if (!Number.isInteger(runEntryIdNumber) || runEntryIdNumber <= 0) {
      throw new AppError('Invalid runEntryId', 400)
    }

    const file = getUploadedFile(req)

    if (!file) {
      throw new AppError('File is required', 400)
    }

    const maxBytesEnv = process.env.CHECKLIST_EVIDENCE_MAX_BYTES
    let maxBytes = 15 * 1024 * 1024

    if (typeof maxBytesEnv === 'string' && maxBytesEnv.trim().length > 0) {
      const parsed = Number.parseInt(maxBytesEnv, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        maxBytes = parsed
      }
    }

    if (file.size > maxBytes) {
      throw new AppError('File too large', 413)
    }

    const allowedMimes = new Set<string>([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ])

    if (!allowedMimes.has(file.mimetype)) {
      throw new AppError('Unsupported file type', 415)
    }

    await validateEvidenceFileSignature(file, maxBytes)

    const meta: ChecklistEvidenceFileMeta = {
      originalName: file.originalname,
      storedName: file.filename,
      contentType: file.mimetype,
      fileSizeBytes: file.size,
      storageProvider: 'local',
      storagePath: file.path,
      sha256: null,
    }

    const result = await uploadChecklistRunEntryEvidence(
      accountId,
      userId,
      runEntryIdNumber,
      meta,
    )

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const getChecklistRunHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountId } = getAuthContext(req)

    const { runId } = req.params
    const runIdNumber = Number(runId)

    if (!Number.isInteger(runIdNumber) || runIdNumber <= 0) {
      throw new AppError('Invalid runId', 400)
    }

    const pageRaw = typeof req.query.page === 'string' ? req.query.page : undefined
    const pageParsed = pageRaw !== undefined ? Number(pageRaw) : NaN
    const page = Number.isInteger(pageParsed) && pageParsed > 0 ? pageParsed : 1

    const pageSizeRaw = typeof req.query.pageSize === 'string' ? req.query.pageSize : undefined
    const pageSizeParsed = pageSizeRaw !== undefined ? Number(pageSizeRaw) : NaN
    let pageSize = Number.isInteger(pageSizeParsed) && pageSizeParsed > 0 ? pageSizeParsed : 50
    if (pageSize > 200) {
      pageSize = 200
    }

    const evidenceRaw = typeof req.query.evidence === 'string' ? req.query.evidence : 'full'
    const evidenceMode: EvidenceMode =
      evidenceRaw === 'none' || evidenceRaw === 'ids' || evidenceRaw === 'full'
        ? evidenceRaw
        : 'full'

    const options: ChecklistRunQueryOptions = {
      page,
      pageSize,
      evidenceMode,
    }

    const run = await getChecklistRun(accountId, runIdNumber, options)

    res.status(200).json(run)
  } catch (err) {
    next(err)
  }
}

export const patchChecklistRunEntryHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountId, userId } = getAuthContext(req)

    const { runEntryId } = req.params
    const runEntryIdNumber = Number(runEntryId)

    if (!Number.isInteger(runEntryIdNumber) || runEntryIdNumber <= 0) {
      throw new AppError('Invalid runEntryId', 400)
    }

    const body = req.body as unknown

    if (!isRecord(body)) {
      throw new AppError('Invalid request body', 400)
    }

    const { result, notes, measuredValue, uom, expectedRowVersionBase64 } = body

    if (typeof expectedRowVersionBase64 !== 'string' || expectedRowVersionBase64.length === 0) {
      throw new AppError('expectedRowVersionBase64 is required', 400)
    }

    if (result !== undefined && !isValidRunEntryResult(result)) {
      throw new AppError('Invalid result value', 400)
    }

    if (!isStringOrNull(notes)) {
      throw new AppError('notes must be a string or null', 400)
    }

    if (!isStringOrNull(measuredValue)) {
      throw new AppError('measuredValue must be a string or null', 400)
    }

    if (!isStringOrNull(uom)) {
      throw new AppError('uom must be a string or null', 400)
    }

    const input: ChecklistRunEntryPatchInput = {
      expectedRowVersionBase64,
    }

    if (result !== undefined) {
      input.result = result
    }

    if (body.hasOwnProperty('notes')) {
      input.notes = notes ?? null
    }

    if (body.hasOwnProperty('measuredValue')) {
      input.measuredValue = measuredValue ?? null
    }

    if (body.hasOwnProperty('uom')) {
      input.uom = uom ?? null
    }

    const hasAnyField =
      input.result !== undefined ||
      input.notes !== undefined ||
      input.measuredValue !== undefined ||
      input.uom !== undefined

    if (!hasAnyField) {
      throw new AppError('No valid fields to update', 400)
    }

    await patchChecklistRunEntry(accountId, userId, runEntryIdNumber, input)

    res.status(200).json({ ok: true })
  } catch (err) {
    next(err)
  }
}

export const cloneChecklistTemplateHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountId, userId } = getAuthContext(req)

    const { id } = req.params
    const templateIdNumber = Number(id)

    if (!Number.isInteger(templateIdNumber) || templateIdNumber <= 0) {
      throw new AppError('Invalid template id', 400)
    }

    const result = await cloneChecklistTemplate(accountId, userId, templateIdNumber)

    res.status(200).json(result)
  } catch (err) {
    next(err)
  }
}

export const patchChecklistRunHandler: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { accountId, userId } = getAuthContext(req)

    const { runId } = req.params
    const runIdNumber = Number(runId)

    if (!Number.isInteger(runIdNumber) || runIdNumber <= 0) {
      throw new AppError('Invalid runId', 400)
    }

    const body = req.body as unknown

    if (!isRecord(body)) {
      throw new AppError('Invalid request body', 400)
    }

    const { status } = body

    if (status !== undefined && typeof status !== 'string') {
      throw new AppError('status must be a string', 400)
    }

    const validStatuses: ChecklistRunStatus[] = ['DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    if (status !== undefined && !validStatuses.includes(status as ChecklistRunStatus)) {
      throw new AppError('Invalid status value', 400)
    }

    const input: ChecklistRunPatchInput = {}

    if (status !== undefined) {
      input.status = status as ChecklistRunStatus
    }

    if (Object.keys(input).length === 0) {
      throw new AppError('No valid fields to update', 400)
    }

    await patchChecklistRun(accountId, userId, runIdNumber, input)

    res.status(200).json({ ok: true })
  } catch (err) {
    next(err)
  }
}


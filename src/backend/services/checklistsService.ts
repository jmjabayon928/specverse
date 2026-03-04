import { AppError } from '@/backend/errors/AppError'
import type {
  ChecklistRunDTO,
  ChecklistRunEntryPatchInput,
  CreateChecklistRunInput,
  CreateChecklistRunResult,
} from '@/domain/checklists/checklistTypes'
import {
  createChecklistRunWithEntries,
  getChecklistRun as getChecklistRunRepository,
  patchChecklistRunEntry as patchChecklistRunEntryRepository,
  uploadChecklistRunEntryEvidence as uploadChecklistRunEntryEvidenceRepository,
} from '@/backend/repositories/checklistsRepository'

export interface ChecklistEvidenceFileMeta {
  originalName: string
  storedName: string
  contentType: string
  fileSizeBytes: number
  storageProvider: string
  storagePath: string
  sha256: string | null
}

export const createChecklistRun = async (
  accountId: number,
  userId: number,
  input: CreateChecklistRunInput,
): Promise<CreateChecklistRunResult> => {
  const result = await createChecklistRunWithEntries({
    ...input,
    accountId,
    userId,
  })

  return result
}

export const uploadChecklistRunEntryEvidence = async (
  accountId: number,
  userId: number,
  runEntryId: number,
  fileMeta: ChecklistEvidenceFileMeta,
): Promise<{
  attachmentId: number
  attachment: {
    attachmentId: number
    originalName: string
    contentType: string
    fileSizeBytes: number
    uploadedAt: string
    uploadedBy: {
      userId: number
      firstName?: string
      lastName?: string
      email?: string
    } | null
  }
}> => {
  const result = await uploadChecklistRunEntryEvidenceRepository({
    accountId,
    userId,
    runEntryId,
    storedName: fileMeta.storedName,
    storageProvider: fileMeta.storageProvider,
    storagePath: fileMeta.storagePath,
    sha256: fileMeta.sha256,
  })

  return result
}

export const getChecklistRun = async (
  accountId: number,
  runId: number,
): Promise<ChecklistRunDTO> => {
  const run = await getChecklistRunRepository(accountId, runId)

  if (!run) {
    throw new AppError('Checklist run not found', 404)
  }

  return run
}

export const patchChecklistRunEntry = async (
  accountId: number,
  userId: number,
  runEntryId: number,
  input: ChecklistRunEntryPatchInput,
): Promise<void> => {
  const result = await patchChecklistRunEntryRepository(accountId, userId, runEntryId, input)

  if (!result.exists) {
    throw new AppError('Checklist run entry not found', 404)
  }

  if (result.updatedRows === 0) {
    throw new AppError(
      'Checklist run entry was modified by another user. Refresh and try again.',
      409,
    )
  }
}



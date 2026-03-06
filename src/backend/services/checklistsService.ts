import { AppError } from '@/backend/errors/AppError'
import type {
  ChecklistRunDTO,
  ChecklistRunEntryPatchInput,
  ChecklistRunPatchInput,
  ChecklistRunPagination,
  ChecklistTemplateCloneResult,
  CreateChecklistRunInput,
  CreateChecklistRunResult,
  EvidenceMode,
} from '@/domain/checklists/checklistTypes'
import {
  cloneChecklistTemplate as cloneChecklistTemplateRepository,
  createChecklistRunWithEntries,
  getChecklistRun as getChecklistRunRepository,
  insertAuditLog,
  listChecklistRunsByAssetId as listChecklistRunsByAssetIdRepository,
  patchChecklistRun as patchChecklistRunRepository,
  patchChecklistRunEntry as patchChecklistRunEntryRepository,
  uploadChecklistRunEntryEvidence as uploadChecklistRunEntryEvidenceRepository,
  type ChecklistRunsListResult,
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

export interface ChecklistRunQueryOptions {
  page?: number
  pageSize?: number
  evidenceMode?: EvidenceMode
}

const safeAuditLog = async (
  params: Parameters<typeof insertAuditLog>[0] & {
    action: string
    accountId: number
    performedBy: number
    route: string
  },
): Promise<void> => {
  try {
    await insertAuditLog(params)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : String(err)

    console.warn({
      message: 'audit_log_failed',
      action: params.action,
      accountId: params.accountId,
      userId: params.performedBy,
      route: params.route,
      error: message,
    })
  }
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

  await safeAuditLog({
    accountId,
    performedBy: userId,
    action: 'CHECKLIST_RUN_CREATE',
    tableName: 'ChecklistRuns',
    recordId: null,
    route: '/api/backend/checklists/run',
    method: 'POST',
    statusCode: 200,
    changes: {
      checklistTemplateId: input.checklistTemplateId,
      checklistRunId: result.checklistRunId,
      entryCount: result.entryCount,
    },
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

  await safeAuditLog({
    accountId,
    performedBy: userId,
    action: 'CHECKLIST_EVIDENCE_UPLOAD',
    tableName: 'ChecklistRunEntryEvidence',
    recordId: null,
    route: `/api/backend/checklists/run-entries/${String(runEntryId)}/evidence`,
    method: 'POST',
    statusCode: 200,
    changes: {
      checklistRunEntryId: runEntryId,
      attachmentId: result.attachment.attachmentId,
      originalName: result.attachment.originalName,
      fileSizeBytes: result.attachment.fileSizeBytes,
      contentType: result.attachment.contentType,
    },
  })

  return result
}

export const getChecklistRun = async (
  accountId: number,
  runId: number,
  options?: ChecklistRunQueryOptions,
): Promise<ChecklistRunDTO & { pagination: ChecklistRunPagination }> => {
  const pageRaw = options?.page
  const page = typeof pageRaw === 'number' && Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const pageSizeRaw = options?.pageSize
  let pageSize =
    typeof pageSizeRaw === 'number' && Number.isInteger(pageSizeRaw) && pageSizeRaw > 0
      ? pageSizeRaw
      : 50
  if (pageSize > 200) {
    pageSize = 200
  }

  const evidenceMode: EvidenceMode = options?.evidenceMode ?? 'full'

  const repoResult = await getChecklistRunRepository(accountId, runId, {
    page,
    pageSize,
    evidenceMode,
  })

  if (!repoResult) {
    throw new AppError('Checklist run not found', 404)
  }

  const { pagination, ...run } = repoResult
  type Entry = (typeof run.entries)[number]

  const shapedEntries: Entry[] = run.entries.map(entry => {
    if (evidenceMode === 'none') {
      // Omit evidence fields from the returned object
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { evidenceAttachmentIds, evidenceAttachments, ...rest } = entry
      return rest as Entry
    }

    if (evidenceMode === 'ids') {
      // Omit full evidence metadata while keeping ids
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { evidenceAttachments, ...rest } = entry
      return rest as Entry
    }

    return entry
  })

  return {
    ...(run as ChecklistRunDTO),
    entries: shapedEntries,
    pagination,
  }
}

export const listChecklistRunsByAssetId = async (
  accountId: number,
  assetId: number,
  page?: number,
  pageSize?: number,
): Promise<ChecklistRunsListResult> => {
  return listChecklistRunsByAssetIdRepository(accountId, assetId, page, pageSize)
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

  const patched: Record<string, unknown> = {}
  if (input.result !== undefined) {
    patched.result = input.result
  }
  if (input.notes !== undefined) {
    patched.notes = input.notes
  }
  if (input.measuredValue !== undefined) {
    patched.measuredValue = input.measuredValue
  }
  if (input.uom !== undefined) {
    patched.uom = input.uom
  }

  await safeAuditLog({
    accountId,
    performedBy: userId,
    action: 'CHECKLIST_RUN_ENTRY_UPDATE',
    tableName: 'ChecklistRunEntries',
    recordId: null,
    route: `/api/backend/checklists/run-entries/${String(runEntryId)}`,
    method: 'PATCH',
    statusCode: 200,
    changes: {
      checklistRunEntryId: runEntryId,
      patched,
      concurrency: {
        expectedRowVersionBase64Present: input.expectedRowVersionBase64.length > 0,
      },
    },
  })
}

export const cloneChecklistTemplate = async (
  accountId: number,
  userId: number,
  templateId: number,
): Promise<ChecklistTemplateCloneResult> => {
  const result = await cloneChecklistTemplateRepository({
    accountId,
    userId,
    templateId,
  })

  await safeAuditLog({
    accountId,
    performedBy: userId,
    action: 'CHECKLIST_TEMPLATE_CLONE',
    tableName: 'ChecklistTemplates',
    recordId: null,
    route: `/api/backend/checklists/templates/${String(templateId)}/clone`,
    method: 'POST',
    statusCode: 200,
    changes: {
      sourceTemplateId: templateId,
      newTemplateId: result.checklistTemplateId,
      versionNumber: result.versionNumber,
      entryCount: result.entryCount,
    },
  })

  return result
}

export const patchChecklistRun = async (
  accountId: number,
  userId: number,
  runId: number,
  input: ChecklistRunPatchInput,
): Promise<void> => {
  const result = await patchChecklistRunRepository({
    accountId,
    userId,
    runId,
    input,
  })

  if (!result.exists) {
    throw new AppError('Checklist run not found', 404)
  }

  if (result.updatedRows === 0) {
    throw new AppError('Checklist run was not updated', 400)
  }

  await safeAuditLog({
    accountId,
    performedBy: userId,
    action: 'CHECKLIST_RUN_UPDATE',
    tableName: 'ChecklistRuns',
    recordId: null,
    route: `/api/backend/checklists/runs/${String(runId)}`,
    method: 'PATCH',
    statusCode: 200,
    changes: {
      checklistRunId: runId,
      patched: input,
    },
  })
}


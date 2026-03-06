export interface CreateChecklistRunInput {
  checklistTemplateId: number
  runName: string
  notes?: string
  projectId?: number
  facilityId?: number
  systemId?: number
  assetId?: number
}

export interface CreateChecklistRunResult {
  checklistRunId: number
  entryCount: number
}

export type ChecklistRunEntryResult = 'PENDING' | 'PASS' | 'FAIL' | 'NA'

export type EvidenceMode = 'none' | 'ids' | 'full'

export interface ChecklistRunEntryPatchInput {
  result?: ChecklistRunEntryResult
  notes?: string | null
  measuredValue?: string | null
  uom?: string | null
  expectedRowVersionBase64: string
}

export interface ChecklistEvidenceAttachmentUserDTO {
  userId: number
  firstName?: string
  lastName?: string
  email?: string
}

export interface ChecklistEvidenceAttachmentDTO {
  attachmentId: number
  originalName: string
  contentType: string
  fileSizeBytes: number
  uploadedAt: string
  uploadedBy: ChecklistEvidenceAttachmentUserDTO | null
}

export interface ChecklistRunEntryDTO {
  runEntryId: number
  templateEntryId: number | null
  sortOrder: number | null
  result: ChecklistRunEntryResult | null
  notes: string | null
  measuredValue: string | null
  uom: string | null
  evidenceAttachmentIds: number[]
  evidenceAttachments: ChecklistEvidenceAttachmentDTO[]
  rowVersionBase64?: string
}

export interface ChecklistRunPagination {
  page: number
  pageSize: number
  totalEntries: number
}

export type ChecklistRunStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export type ChecklistTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface ChecklistRunDTO {
  runId: number
  checklistTemplateId: number
  checklistTemplateVersionNumber: number | null
  runName: string
  notes: string | null
  projectId: number | null
  facilityId: number | null
  systemId: number | null
  assetId: number | null
  status: ChecklistRunStatus
  createdAt: string
  updatedAt: string | null
  completedAt: string | null
  entries: ChecklistRunEntryDTO[]
  totalEntries: number
  completedEntries: number
  pendingEntries: number
  passEntries: number
  failEntries: number
  naEntries: number
  completionPercentage: number
}

export interface ChecklistRunPatchInput {
  status?: ChecklistRunStatus
}

export interface ChecklistTemplateCloneResult {
  checklistTemplateId: number
  versionNumber: number
  entryCount: number
}

export interface ChecklistRunSummary {
  checklistRunId: number
  runName: string
  status: ChecklistRunStatus
  createdAt: string
  checklistTemplateId: number
  totalEntries: number
  completedEntries: number
  completionPercentage: number
}



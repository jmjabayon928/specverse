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
}

export interface ChecklistRunPagination {
  page: number
  pageSize: number
  totalEntries: number
}

export interface ChecklistRunDTO {
  runId: number
  checklistTemplateId: number
  runName: string
  notes: string | null
  projectId: number | null
  facilityId: number | null
  systemId: number | null
  assetId: number | null
  status: string
  entries: ChecklistRunEntryDTO[]
}



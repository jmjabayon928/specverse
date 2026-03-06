import { poolPromise, sql } from '@/backend/config/db'
import { AppError } from '@/backend/errors/AppError'
import type {
  ChecklistRunDTO,
  ChecklistRunEntryPatchInput,
  ChecklistRunEntryResult,
  ChecklistRunPagination,
  ChecklistRunPatchInput,
  ChecklistRunStatus,
  ChecklistRunSummary,
  ChecklistTemplateCloneResult,
  CreateChecklistRunInput,
  CreateChecklistRunResult,
  EvidenceMode,
} from '@/domain/checklists/checklistTypes'

interface CreateChecklistRunRepositoryArgs extends CreateChecklistRunInput {
  accountId: number
  userId: number
}

interface UploadChecklistRunEntryEvidenceArgs {
  accountId: number
  userId: number
  runEntryId: number
  storedName: string
  storageProvider: string
  storagePath: string
  sha256: string | null
}

interface InsertAuditLogArgs {
  accountId: number
  performedBy: number
  action: string
  tableName: string | null
  recordId: number | null
  route: string
  method: string
  statusCode: number
  changes: unknown
}

export const createChecklistRunWithEntries = async (
  args: CreateChecklistRunRepositoryArgs,
): Promise<CreateChecklistRunResult> => {
  const pool = await poolPromise
  const transaction = new sql.Transaction(pool)

  await transaction.begin()

  try {
    // Get template version to snapshot
    const templateVersionRequest = new sql.Request(transaction)
    templateVersionRequest.input('AccountID', sql.Int, args.accountId)
    templateVersionRequest.input('ChecklistTemplateID', sql.Int, args.checklistTemplateId)

    const templateVersionResult = await templateVersionRequest.query<{
      VersionNumber: number
    }>(`
      SELECT VersionNumber
      FROM dbo.ChecklistTemplates
      WHERE AccountID = @AccountID
        AND ChecklistTemplateID = @ChecklistTemplateID;
    `)

    const templateVersion = templateVersionResult.recordset[0]?.VersionNumber ?? 1

    const insertRunRequest = new sql.Request(transaction)

    insertRunRequest.input('AccountID', sql.Int, args.accountId)
    insertRunRequest.input('ChecklistTemplateID', sql.Int, args.checklistTemplateId)
    insertRunRequest.input('ChecklistTemplateVersionNumber', sql.Int, templateVersion)
    insertRunRequest.input('RunName', sql.NVarChar(255), args.runName)
    insertRunRequest.input('Notes', sql.NVarChar(4000), args.notes ?? null)
    insertRunRequest.input('ProjectID', sql.Int, args.projectId ?? null)
    insertRunRequest.input('FacilityID', sql.Int, args.facilityId ?? null)
    insertRunRequest.input('SystemID', sql.Int, args.systemId ?? null)
    insertRunRequest.input('AssetID', sql.Int, args.assetId ?? null)
    insertRunRequest.input('UserID', sql.Int, args.userId)

    const insertRunResult = await insertRunRequest.query<{
      ChecklistRunID: number | bigint
    }>(`
      INSERT INTO dbo.ChecklistRuns (
        AccountID,
        ChecklistTemplateID,
        ChecklistTemplateVersionNumber,
        RunName,
        Notes,
        ProjectID,
        FacilityID,
        SystemID,
        AssetID,
        Status,
        CreatedAt,
        UpdatedAt,
        CreatedBy
      )
      OUTPUT inserted.ChecklistRunID
      VALUES (
        @AccountID,
        @ChecklistTemplateID,
        @ChecklistTemplateVersionNumber,
        @RunName,
        @Notes,
        @ProjectID,
        @FacilityID,
        @SystemID,
        @AssetID,
        'DRAFT',
        SYSUTCDATETIME(),
        SYSUTCDATETIME(),
        @UserID
      );
    `)

    const insertedRun = insertRunResult.recordset[0]

    if (!insertedRun) {
      throw new Error('Failed to create checklist run')
    }

    const checklistRunId = Number(insertedRun.ChecklistRunID)

    const insertEntriesRequest = new sql.Request(transaction)

    insertEntriesRequest.input('AccountID', sql.Int, args.accountId)
    insertEntriesRequest.input('ChecklistTemplateID', sql.Int, args.checklistTemplateId)
    insertEntriesRequest.input('ChecklistRunID', sql.BigInt, checklistRunId)

    const insertEntriesResult = await insertEntriesRequest.query<{
      EntryCount: number
    }>(`
      INSERT INTO dbo.ChecklistRunEntries (
        AccountID,
        ChecklistRunID,
        ChecklistTemplateEntryID,
        SortOrder,
        Result
      )
      SELECT
        te.AccountID,
        @ChecklistRunID AS ChecklistRunID,
        te.ChecklistTemplateEntryID,
        te.SortOrder,
        NULL AS Result
      FROM dbo.ChecklistTemplateEntries te
      WHERE te.AccountID = @AccountID
        AND te.ChecklistTemplateID = @ChecklistTemplateID;

      SELECT @@ROWCOUNT AS EntryCount;
    `)

    const entryCountRow = insertEntriesResult.recordset[0]

    if (!entryCountRow) {
      throw new Error('Failed to create checklist run entries')
    }

    const entryCount = Number(entryCountRow.EntryCount)

    await transaction.commit()

    const result: CreateChecklistRunResult = {
      checklistRunId,
      entryCount,
    }

    return result
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {
      // ignore rollback errors
    }

    throw err
  }
}

export const insertAuditLog = async (args: InsertAuditLogArgs): Promise<void> => {
  const pool = await poolPromise
  const request = new sql.Request(pool)

  const changesJson = JSON.stringify(args.changes ?? {})

  request.input('AccountID', sql.Int, args.accountId)
  request.input('PerformedBy', sql.Int, args.performedBy)
  request.input('Action', sql.NVarChar(128), args.action)
  request.input('TableName', sql.NVarChar(128), args.tableName)
  request.input('RecordID', sql.Int, args.recordId)
  request.input('Route', sql.NVarChar(512), args.route)
  request.input('Method', sql.NVarChar(16), args.method)
  request.input('StatusCode', sql.Int, args.statusCode)
  request.input('ChangesJson', sql.NVarChar(sql.MAX), changesJson)

  await request.query(`
    INSERT INTO dbo.AuditLogs (
      TableName,
      RecordID,
      Action,
      PerformedBy,
      PerformedAt,
      Route,
      Method,
      StatusCode,
      Changes,
      AccountID
    )
    VALUES (
      @TableName,
      @RecordID,
      @Action,
      @PerformedBy,
      SYSUTCDATETIME(),
      @Route,
      @Method,
      @StatusCode,
      @ChangesJson,
      @AccountID
    );
  `)
}

interface ChecklistEvidenceAttachmentRow {
  AttachmentID: number
  OriginalName: string
  ContentType: string
  FileSizeBytes: number
  UploadedAt: Date
  UploadedByUserID: number | null
  UploadedByFirstName: string | null
  UploadedByLastName: string | null
  UploadedByEmail: string | null
}

export const uploadChecklistRunEntryEvidence = async (
  args: UploadChecklistRunEntryEvidenceArgs,
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
  const pool = await poolPromise
  const transaction = new sql.Transaction(pool)

  await transaction.begin()

  try {
    const runEntryCheckRequest = new sql.Request(transaction)

    runEntryCheckRequest.input('AccountID', sql.Int, args.accountId)
    runEntryCheckRequest.input('ChecklistRunEntryID', sql.BigInt, args.runEntryId)

    const runEntryResult = await runEntryCheckRequest.query<{
      ExistsFlag: number
    }>(`
      SELECT TOP (1)
        1 AS ExistsFlag
      FROM dbo.ChecklistRunEntries
      WHERE AccountID = @AccountID
        AND ChecklistRunEntryID = @ChecklistRunEntryID;
    `)

    if (runEntryResult.recordset.length === 0) {
      throw new AppError('Checklist run entry not found', 404)
    }

    const insertAttachmentRequest = new sql.Request(transaction)

    insertAttachmentRequest.input('AccountID', sql.Int, args.accountId)
    insertAttachmentRequest.input('StoredName', sql.NVarChar(255), args.storedName)
    insertAttachmentRequest.input('StorageProvider', sql.NVarChar(50), args.storageProvider)
    insertAttachmentRequest.input('StoragePath', sql.NVarChar(1024), args.storagePath)
    insertAttachmentRequest.input('Sha256', sql.NVarChar(64), args.sha256)
    insertAttachmentRequest.input('UploadedBy', sql.Int, args.userId)

    const insertAttachmentResult = await insertAttachmentRequest.query<{
      AttachmentID: number
    }>(`
      INSERT INTO dbo.Attachments (
        AccountID,
        StoredName,
        StorageProvider,
        StoragePath,
        Sha256,
        UploadedBy,
        UploadedAt
      )
      OUTPUT inserted.AttachmentID
      VALUES (
        @AccountID,
        @StoredName,
        @StorageProvider,
        @StoragePath,
        @Sha256,
        @UploadedBy,
        SYSUTCDATETIME()
      );
    `)

    const attachmentRow = insertAttachmentResult.recordset[0]

    if (!attachmentRow) {
      throw new Error('Failed to create attachment')
    }

    const attachmentId = attachmentRow.AttachmentID

    const linkRequest = new sql.Request(transaction)

    linkRequest.input('AccountID', sql.Int, args.accountId)
    linkRequest.input('ChecklistRunEntryID', sql.BigInt, args.runEntryId)
    linkRequest.input('AttachmentID', sql.Int, attachmentId)
    linkRequest.input('LinkedBy', sql.Int, args.userId)

    const linkResult = await linkRequest.query(`
      INSERT INTO dbo.ChecklistRunEntryAttachments (
        ChecklistRunEntryID,
        AttachmentID,
        AccountID,
        LinkedBy,
        LinkedAt
      )
      SELECT
        cre.ChecklistRunEntryID,
        a.AttachmentID,
        cre.AccountID,
        @LinkedBy,
        SYSUTCDATETIME()
      FROM dbo.ChecklistRunEntries cre
      INNER JOIN dbo.Attachments a ON a.AttachmentID = @AttachmentID
      WHERE cre.ChecklistRunEntryID = @ChecklistRunEntryID
        AND cre.AccountID = @AccountID
        AND a.AccountID = @AccountID;
    `)

    const rowsAffectedArray =
      (linkResult as { rowsAffected?: number[] }).rowsAffected ?? []
    const linkedRows = rowsAffectedArray.reduce((sum, value) => sum + value, 0)

    if (linkedRows === 0) {
      throw new AppError('Failed to link attachment to checklist run entry', 400)
    }

    const metadataRequest = new sql.Request(transaction)

    metadataRequest.input('AccountID', sql.Int, args.accountId)
    metadataRequest.input('AttachmentID', sql.Int, attachmentId)

    const metadataResult = await metadataRequest.query<ChecklistEvidenceAttachmentRow>(`
      SELECT
        a.AttachmentID,
        a.StoredName AS OriginalName,
        a.StorageProvider AS ContentType,
        a.FileSizeBytes,
        a.UploadedAt,
        u.UserID AS UploadedByUserID,
        u.FirstName AS UploadedByFirstName,
        u.LastName AS UploadedByLastName,
        u.Email AS UploadedByEmail
      FROM dbo.Attachments a
      LEFT JOIN dbo.Users u ON u.UserID = a.UploadedBy
      WHERE a.AccountID = @AccountID
        AND a.AttachmentID = @AttachmentID;
    `)

    const metadataRow = metadataResult.recordset[0]

    await transaction.commit()

    const uploadedBy =
      metadataRow && metadataRow.UploadedByUserID != null
        ? {
            userId: metadataRow.UploadedByUserID,
            firstName: metadataRow.UploadedByFirstName ?? undefined,
            lastName: metadataRow.UploadedByLastName ?? undefined,
            email: metadataRow.UploadedByEmail ?? undefined,
          }
        : null

    const attachment = metadataRow
      ? {
          attachmentId: metadataRow.AttachmentID,
          originalName: metadataRow.OriginalName,
          contentType: metadataRow.ContentType,
          fileSizeBytes: metadataRow.FileSizeBytes,
          uploadedAt: metadataRow.UploadedAt.toISOString(),
          uploadedBy,
        }
      : {
          attachmentId,
          originalName: args.storedName,
          contentType: args.storageProvider,
          fileSizeBytes: 0,
          uploadedAt: new Date().toISOString(),
          uploadedBy: null,
        }

    return { attachmentId, attachment }
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {
      // ignore rollback errors
    }

    throw err
  }
}
interface ChecklistRunHeaderRow {
  ChecklistRunID: number | bigint
  ChecklistTemplateID: number
  ChecklistTemplateVersionNumber: number | null
  RunName: string
  Notes: string | null
  ProjectID: number | null
  FacilityID: number | null
  SystemID: number | null
  AssetID: number | null
  Status: string
  CreatedAt: Date
  UpdatedAt: Date | null
  CompletedAt: Date | null
  TotalEntries: number
  CompletedEntries: number
  PendingEntries: number
  PassEntries: number
  FailEntries: number
  NaEntries: number
}

interface ChecklistRunEntryRow {
  ChecklistRunEntryID: number | bigint
  ChecklistTemplateEntryID: number | null
  SortOrder: number | null
  Result: ChecklistRunEntryResult | null
  Notes: string | null
  MeasuredValue: string | null
  Uom: string | null
  RowVersion: Buffer | Uint8Array
}

interface ChecklistRunEntryAttachmentMetaRow {
  ChecklistRunEntryID: number | bigint
  AttachmentID: number
  StoredName: string
  ContentType: string | null
  FileSizeBytes: number | null
  UploadedAt: Date
  UploadedByUserID: number | null
  UploadedByFirstName: string | null
  UploadedByLastName: string | null
  UploadedByEmail: string | null
}
interface ChecklistRunQueryOptions {
  page?: number
  pageSize?: number
  evidenceMode?: EvidenceMode
}

export const getChecklistRun = async (
  accountId: number,
  runId: number,
  options?: ChecklistRunQueryOptions,
): Promise<(ChecklistRunDTO & { pagination: ChecklistRunPagination }) | null> => {
  const pool = await poolPromise

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

  const offset = (page - 1) * pageSize

  const headerRequest = new sql.Request(pool)
  headerRequest.input('AccountID', sql.Int, accountId)
  headerRequest.input('ChecklistRunID', sql.BigInt, runId)

  const headerResult = await headerRequest.query<ChecklistRunHeaderRow>(`
    SELECT
      cr.ChecklistRunID,
      cr.ChecklistTemplateID,
      cr.ChecklistTemplateVersionNumber,
      cr.RunName,
      cr.Notes,
      cr.ProjectID,
      cr.FacilityID,
      cr.SystemID,
      cr.AssetID,
      cr.Status,
      cr.CreatedAt,
      cr.UpdatedAt,
      cr.CompletedAt,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = @ChecklistRunID
      ) AS TotalEntries,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = @ChecklistRunID
          AND e.Result IS NOT NULL
          AND e.Result != 'PENDING'
      ) AS CompletedEntries,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = @ChecklistRunID
          AND (e.Result IS NULL OR e.Result = 'PENDING')
      ) AS PendingEntries,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = @ChecklistRunID
          AND e.Result = 'PASS'
      ) AS PassEntries,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = @ChecklistRunID
          AND e.Result = 'FAIL'
      ) AS FailEntries,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = @ChecklistRunID
          AND e.Result = 'NA'
      ) AS NaEntries
    FROM dbo.ChecklistRuns cr
    WHERE cr.AccountID = @AccountID
      AND cr.ChecklistRunID = @ChecklistRunID;
  `)

  const header = headerResult.recordset[0]

  if (!header) {
    return null
  }

  const totalEntries = header.TotalEntries
  const completedEntries = header.CompletedEntries
  const pendingEntries = header.PendingEntries
  const passEntries = header.PassEntries
  const failEntries = header.FailEntries
  const naEntries = header.NaEntries
  const completionPercentage =
    totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0

  const entriesRequest = new sql.Request(pool)
  entriesRequest.input('AccountID', sql.Int, accountId)
  entriesRequest.input('ChecklistRunID', sql.BigInt, runId)
  entriesRequest.input('Offset', sql.Int, offset)
  entriesRequest.input('PageSize', sql.Int, pageSize)

  const entriesResult = await entriesRequest.query<ChecklistRunEntryRow>(`
    SELECT
      ChecklistRunEntryID,
      ChecklistTemplateEntryID,
      SortOrder,
      Result,
      Notes,
      MeasuredValue,
      Uom,
      RowVersion
    FROM dbo.ChecklistRunEntries
    WHERE AccountID = @AccountID
      AND ChecklistRunID = @ChecklistRunID
    ORDER BY SortOrder, ChecklistRunEntryID
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const runEntryIds = entriesResult.recordset.map(row => Number(row.ChecklistRunEntryID))

  const attachmentsByEntry = new Map<number, number[]>()
  const attachmentsMetaByEntry = new Map<number, ChecklistRunEntryAttachmentMetaRow[]>()

  if (runEntryIds.length > 0 && evidenceMode !== 'none') {
    const attachmentsMetaRequest = new sql.Request(pool)
    attachmentsMetaRequest.input('AccountID', sql.Int, accountId)
    attachmentsMetaRequest.input('ChecklistRunID', sql.BigInt, runId)

    const entryIdParams: string[] = []
    runEntryIds.forEach((id, index) => {
      const paramName = `EntryID${index}`
      entryIdParams.push(`@${paramName}`)
      attachmentsMetaRequest.input(paramName, sql.BigInt, id)
    })

    const attachmentsMetaResult =
      await attachmentsMetaRequest.query<ChecklistRunEntryAttachmentMetaRow>(`
        SELECT
          cre.ChecklistRunEntryID,
          a.AttachmentID,
          a.StoredName,
          a.ContentType,
          a.FileSizeBytes,
          a.UploadedAt,
          u.UserID AS UploadedByUserID,
          u.FirstName AS UploadedByFirstName,
          u.LastName AS UploadedByLastName,
          u.Email AS UploadedByEmail
        FROM dbo.ChecklistRunEntryAttachments rea
        INNER JOIN dbo.ChecklistRunEntries cre
          ON cre.ChecklistRunEntryID = rea.ChecklistRunEntryID
        INNER JOIN dbo.Attachments a
          ON a.AttachmentID = rea.AttachmentID
        LEFT JOIN dbo.Users u
          ON u.UserID = a.UploadedBy
        WHERE cre.AccountID = @AccountID
          AND a.AccountID = @AccountID
          AND cre.ChecklistRunID = @ChecklistRunID
          AND cre.ChecklistRunEntryID IN (${entryIdParams.join(', ')});
      `)

    for (const row of attachmentsMetaResult.recordset) {
      const entryId = Number(row.ChecklistRunEntryID)
      const idsList = attachmentsByEntry.get(entryId) ?? []
      idsList.push(row.AttachmentID)
      attachmentsByEntry.set(entryId, idsList)

      const list = attachmentsMetaByEntry.get(entryId) ?? []
      list.push(row)
      attachmentsMetaByEntry.set(entryId, list)
    }
  }

  const entries = entriesResult.recordset.map(row => {
    const runEntryId = Number(row.ChecklistRunEntryID)
    const evidenceAttachmentIds = attachmentsByEntry.get(runEntryId) ?? []
    const evidenceAttachmentMetaRows = attachmentsMetaByEntry.get(runEntryId) ?? []

    const evidenceAttachments = evidenceAttachmentMetaRows
      .slice()
      .sort((a, b) => a.AttachmentID - b.AttachmentID)
      .map(meta => {
        const uploadedBy =
          meta.UploadedByUserID != null
            ? {
                userId: meta.UploadedByUserID,
                firstName: meta.UploadedByFirstName ?? undefined,
                lastName: meta.UploadedByLastName ?? undefined,
                email: meta.UploadedByEmail ?? undefined,
              }
            : null

        return {
          attachmentId: meta.AttachmentID,
          originalName: meta.StoredName,
          contentType: meta.ContentType ?? '',
          fileSizeBytes: meta.FileSizeBytes ?? 0,
          uploadedAt: meta.UploadedAt.toISOString(),
          uploadedBy,
        }
      })

    const rowVersionValue = row.RowVersion
    const rowVersionBase64 =
      typeof Buffer !== 'undefined' && rowVersionValue instanceof Uint8Array
        ? Buffer.from(rowVersionValue).toString('base64')
        : typeof Buffer !== 'undefined' && (rowVersionValue as Buffer | undefined)
        ? (rowVersionValue as Buffer).toString('base64')
        : ''

    return {
      runEntryId,
      templateEntryId: row.ChecklistTemplateEntryID,
      sortOrder: row.SortOrder,
      result: row.Result,
      notes: row.Notes,
      measuredValue: row.MeasuredValue,
      uom: row.Uom,
      evidenceAttachmentIds,
      evidenceAttachments,
      rowVersionBase64,
    }
  })

  const dto: ChecklistRunDTO = {
    runId: Number(header.ChecklistRunID),
    checklistTemplateId: header.ChecklistTemplateID,
    checklistTemplateVersionNumber: header.ChecklistTemplateVersionNumber,
    runName: header.RunName,
    notes: header.Notes,
    projectId: header.ProjectID,
    facilityId: header.FacilityID,
    systemId: header.SystemID,
    assetId: header.AssetID,
    status: header.Status as ChecklistRunStatus,
    createdAt: header.CreatedAt instanceof Date ? header.CreatedAt.toISOString() : String(header.CreatedAt),
    updatedAt: header.UpdatedAt instanceof Date ? header.UpdatedAt.toISOString() : (header.UpdatedAt ? String(header.UpdatedAt) : null),
    completedAt: header.CompletedAt instanceof Date ? header.CompletedAt.toISOString() : (header.CompletedAt ? String(header.CompletedAt) : null),
    entries,
    totalEntries,
    completedEntries,
    pendingEntries,
    passEntries,
    failEntries,
    naEntries,
    completionPercentage,
  }
  const pagination: ChecklistRunPagination = {
    page,
    pageSize,
    totalEntries,
  }

  return { ...dto, pagination }
}

export interface ChecklistRunsListResult {
  items: ChecklistRunSummary[]
  total: number
  page: number
  pageSize: number
}

export const listChecklistRunsByAssetId = async (
  accountId: number,
  assetId: number,
  page: number = 1,
  pageSize: number = 10,
): Promise<ChecklistRunsListResult> => {
  const pool = await poolPromise

  const safePage = Number.isInteger(page) && page > 0 ? page : 1
  let safePageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10
  if (safePageSize > 200) {
    safePageSize = 200
  }

  const offset = (safePage - 1) * safePageSize

  // Count total
  const countRequest = new sql.Request(pool)
  countRequest.input('AccountID', sql.Int, accountId)
  countRequest.input('AssetID', sql.Int, assetId)

  const countResult = await countRequest.query<{ Total: number }>(`
    SELECT COUNT(*) AS Total
    FROM dbo.ChecklistRuns
    WHERE AccountID = @AccountID
      AND AssetID = @AssetID;
  `)

  const total = countResult.recordset[0]?.Total ?? 0

  // Get paginated items
  const listRequest = new sql.Request(pool)
  listRequest.input('AccountID', sql.Int, accountId)
  listRequest.input('AssetID', sql.Int, assetId)
  listRequest.input('Offset', sql.Int, offset)
  listRequest.input('PageSize', sql.Int, safePageSize)

  const listResult = await listRequest.query<{
    ChecklistRunID: number | bigint
    RunName: string
    Status: string
    CreatedAt: Date
    ChecklistTemplateID: number
    TotalEntries: number
    CompletedEntries: number
  }>(`
    SELECT
      cr.ChecklistRunID,
      cr.RunName,
      cr.Status,
      cr.CreatedAt,
      cr.ChecklistTemplateID,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = cr.ChecklistRunID
      ) AS TotalEntries,
      (
        SELECT COUNT(1)
        FROM dbo.ChecklistRunEntries e
        WHERE e.AccountID = @AccountID
          AND e.ChecklistRunID = cr.ChecklistRunID
          AND e.Result IS NOT NULL
          AND e.Result != 'PENDING'
      ) AS CompletedEntries
    FROM dbo.ChecklistRuns cr
    WHERE cr.AccountID = @AccountID
      AND cr.AssetID = @AssetID
    ORDER BY cr.CreatedAt DESC, cr.ChecklistRunID DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
  `)

  const items: ChecklistRunSummary[] = listResult.recordset.map(row => {
    const totalEntries = row.TotalEntries
    const completedEntries = row.CompletedEntries
    const completionPercentage = totalEntries > 0 ? Math.round((completedEntries / totalEntries) * 100) : 0

    return {
      checklistRunId: Number(row.ChecklistRunID),
      runName: row.RunName,
      status: row.Status as ChecklistRunStatus,
      createdAt: row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : String(row.CreatedAt),
      checklistTemplateId: row.ChecklistTemplateID,
      totalEntries,
      completedEntries,
      completionPercentage,
    }
  })

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
  }
}

export const patchChecklistRunEntry = async (
  accountId: number,
  userId: number,
  runEntryId: number,
  input: ChecklistRunEntryPatchInput,
): Promise<{ exists: boolean; updatedRows: number }> => {
  const pool = await poolPromise
  const transaction = new sql.Transaction(pool)

  await transaction.begin()

  try {
    // Check entry exists and get run status
    const checkRequest = new sql.Request(transaction)
    checkRequest.input('AccountID', sql.Int, accountId)
    checkRequest.input('ChecklistRunEntryID', sql.BigInt, runEntryId)

    const checkResult = await checkRequest.query<{
      RowVersion: Buffer | Uint8Array
      ChecklistRunID: number | bigint
      RunStatus: string
    }>(`
      SELECT
        cre.RowVersion,
        cre.ChecklistRunID,
        cr.Status AS RunStatus
      FROM dbo.ChecklistRunEntries cre
      INNER JOIN dbo.ChecklistRuns cr
        ON cr.ChecklistRunID = cre.ChecklistRunID
        AND cr.AccountID = cre.AccountID
      WHERE cre.AccountID = @AccountID
        AND cre.ChecklistRunEntryID = @ChecklistRunEntryID;
    `)

    if (checkResult.recordset.length === 0) {
      await transaction.rollback()
      return { exists: false, updatedRows: 0 }
    }

    const runStatus = checkResult.recordset[0]!.RunStatus as ChecklistRunStatus
    const checklistRunId = Number(checkResult.recordset[0]!.ChecklistRunID)

    // Block updates for COMPLETED or CANCELLED runs
    if (runStatus === 'COMPLETED' || runStatus === 'CANCELLED') {
      await transaction.rollback()
      throw new AppError(`Cannot update entries for ${runStatus} checklist run`, 400)
    }

    const updateRequest = new sql.Request(transaction)
    updateRequest.input('AccountID', sql.Int, accountId)
    updateRequest.input('ChecklistRunEntryID', sql.BigInt, runEntryId)

    const setClauses: string[] = []

    if (input.result !== undefined) {
      updateRequest.input('Result', sql.NVarChar(16), input.result)
      setClauses.push('Result = @Result')
    }

    if (input.notes !== undefined) {
      updateRequest.input('Notes', sql.NVarChar(4000), input.notes)
      setClauses.push('Notes = @Notes')
    }

    if (input.measuredValue !== undefined) {
      updateRequest.input('MeasuredValue', sql.NVarChar(255), input.measuredValue)
      setClauses.push('MeasuredValue = @MeasuredValue')
    }

    if (input.uom !== undefined) {
      updateRequest.input('Uom', sql.NVarChar(64), input.uom)
      setClauses.push('Uom = @Uom')
    }

    if (setClauses.length === 0) {
      await transaction.rollback()
      return { exists: true, updatedRows: 0 }
    }

    const expectedRowVersionBase64 = input.expectedRowVersionBase64
    const expectedRowVersionBuffer =
      typeof Buffer !== 'undefined'
        ? Buffer.from(expectedRowVersionBase64, 'base64')
        : expectedRowVersionBase64

    updateRequest.input('ExpectedRowVersion', sql.VarBinary(8), expectedRowVersionBuffer)

    const sqlText = `
      UPDATE dbo.ChecklistRunEntries
      SET ${setClauses.join(', ')}
      WHERE AccountID = @AccountID
        AND ChecklistRunEntryID = @ChecklistRunEntryID
        AND RowVersion = @ExpectedRowVersion;
    `

    const updateResult = await updateRequest.query(sqlText)

    const rowsAffectedArray = (updateResult as { rowsAffected?: number[] }).rowsAffected ?? []
    const rowsAffected = rowsAffectedArray.reduce((sum, value) => sum + value, 0)

    if (rowsAffected === 0) {
      await transaction.rollback()
      return { exists: true, updatedRows: 0 }
    }

    // Check if we need to auto-transition status
    const statusUpdateRequest = new sql.Request(transaction)
    statusUpdateRequest.input('AccountID', sql.Int, accountId)
    statusUpdateRequest.input('ChecklistRunID', sql.BigInt, checklistRunId)

    // Check completion status
    const completionCheck = await statusUpdateRequest.query<{
      PendingCount: number
    }>(`
      SELECT COUNT(1) AS PendingCount
      FROM dbo.ChecklistRunEntries
      WHERE AccountID = @AccountID
        AND ChecklistRunID = @ChecklistRunID
        AND (Result IS NULL OR Result = 'PENDING');
    `)

    const pendingCount = completionCheck.recordset[0]?.PendingCount ?? 0
    const isCompleted = pendingCount === 0

    // Auto-transition logic
    if (runStatus === 'DRAFT' && (input.result !== undefined && input.result !== 'PENDING')) {
      // Transition DRAFT -> IN_PROGRESS on first meaningful update
      const transitionRequest = new sql.Request(transaction)
      transitionRequest.input('AccountID', sql.Int, accountId)
      transitionRequest.input('ChecklistRunID', sql.BigInt, checklistRunId)
      await transitionRequest.query(`
        UPDATE dbo.ChecklistRuns
        SET Status = 'IN_PROGRESS',
            UpdatedAt = SYSUTCDATETIME()
        WHERE AccountID = @AccountID
          AND ChecklistRunID = @ChecklistRunID
          AND Status = 'DRAFT';
      `)
    } else if (runStatus === 'IN_PROGRESS' && isCompleted) {
      // Transition IN_PROGRESS -> COMPLETED when all entries completed
      const completeRequest = new sql.Request(transaction)
      completeRequest.input('AccountID', sql.Int, accountId)
      completeRequest.input('ChecklistRunID', sql.BigInt, checklistRunId)
      await completeRequest.query(`
        UPDATE dbo.ChecklistRuns
        SET Status = 'COMPLETED',
            UpdatedAt = SYSUTCDATETIME(),
            CompletedAt = SYSUTCDATETIME()
        WHERE AccountID = @AccountID
          AND ChecklistRunID = @ChecklistRunID
          AND Status = 'IN_PROGRESS';
      `)
    } else if (runStatus !== 'DRAFT') {
      // Update UpdatedAt for IN_PROGRESS runs
      const updateTimeRequest = new sql.Request(transaction)
      updateTimeRequest.input('AccountID', sql.Int, accountId)
      updateTimeRequest.input('ChecklistRunID', sql.BigInt, checklistRunId)
      await updateTimeRequest.query(`
        UPDATE dbo.ChecklistRuns
        SET UpdatedAt = SYSUTCDATETIME()
        WHERE AccountID = @AccountID
          AND ChecklistRunID = @ChecklistRunID;
      `)
    }

    await transaction.commit()
    return { exists: true, updatedRows: rowsAffected }
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {
      // ignore rollback errors
    }
    throw err
  }
}

interface CloneChecklistTemplateArgs {
  accountId: number
  userId: number
  templateId: number
}

export const cloneChecklistTemplate = async (
  args: CloneChecklistTemplateArgs,
): Promise<ChecklistTemplateCloneResult> => {
  const pool = await poolPromise
  const transaction = new sql.Transaction(pool)

  await transaction.begin()

  try {
    // Get source template
    const sourceRequest = new sql.Request(transaction)
    sourceRequest.input('AccountID', sql.Int, args.accountId)
    sourceRequest.input('ChecklistTemplateID', sql.Int, args.templateId)

    const sourceResult = await sourceRequest.query<{
      ChecklistTemplateID: number
      VersionNumber: number
      AccountID: number
    }>(`
      SELECT ChecklistTemplateID, VersionNumber, AccountID
      FROM dbo.ChecklistTemplates
      WHERE AccountID = @AccountID
        AND ChecklistTemplateID = @ChecklistTemplateID;
    `)

    if (sourceResult.recordset.length === 0) {
      throw new AppError('Checklist template not found', 404)
    }

    const source = sourceResult.recordset[0]!
    const newVersionNumber = source.VersionNumber + 1

    // Create new template version
    // Only use columns proven in allowlist: AccountID, VersionNumber, Status
    // ChecklistTemplateID is assumed to be IDENTITY (auto-generated)
    // TemplateName, CreatedAt, CreatedBy are not proven and omitted
    const insertTemplateRequest = new sql.Request(transaction)
    insertTemplateRequest.input('AccountID', sql.Int, args.accountId)
    insertTemplateRequest.input('VersionNumber', sql.Int, newVersionNumber)
    insertTemplateRequest.input('Status', sql.NVarChar(16), 'DRAFT')

    const insertTemplateResult = await insertTemplateRequest.query<{
      ChecklistTemplateID: number
    }>(`
      INSERT INTO dbo.ChecklistTemplates (
        AccountID,
        VersionNumber,
        Status
      )
      OUTPUT inserted.ChecklistTemplateID
      VALUES (
        @AccountID,
        @VersionNumber,
        @Status
      );
    `)

    const newTemplateId = Number(insertTemplateResult.recordset[0]?.ChecklistTemplateID)
    if (!newTemplateId) {
      throw new Error('Failed to create checklist template')
    }

    // Clone template entries
    const cloneEntriesRequest = new sql.Request(transaction)
    cloneEntriesRequest.input('AccountID', sql.Int, args.accountId)
    cloneEntriesRequest.input('SourceTemplateID', sql.Int, args.templateId)
    cloneEntriesRequest.input('TargetTemplateID', sql.Int, newTemplateId)

    const cloneEntriesResult = await cloneEntriesRequest.query<{
      EntryCount: number
    }>(`
      INSERT INTO dbo.ChecklistTemplateEntries (
        AccountID,
        ChecklistTemplateID,
        EntryText,
        SortOrder,
        Required,
        ResultType
      )
      SELECT
        AccountID,
        @TargetTemplateID AS ChecklistTemplateID,
        EntryText,
        SortOrder,
        Required,
        ResultType
      FROM dbo.ChecklistTemplateEntries
      WHERE AccountID = @AccountID
        AND ChecklistTemplateID = @SourceTemplateID;

      SELECT @@ROWCOUNT AS EntryCount;
    `)

    const entryCount = Number(cloneEntriesResult.recordset[0]?.EntryCount ?? 0)

    await transaction.commit()

    return {
      checklistTemplateId: newTemplateId,
      versionNumber: newVersionNumber,
      entryCount,
    }
  } catch (err) {
    try {
      await transaction.rollback()
    } catch {
      // ignore rollback errors
    }
    throw err
  }
}

interface PatchChecklistRunArgs {
  accountId: number
  userId: number
  runId: number
  input: ChecklistRunPatchInput
}

export const patchChecklistRun = async (
  args: PatchChecklistRunArgs,
): Promise<{ exists: boolean; updatedRows: number }> => {
  const pool = await poolPromise

  // Check run exists and get current status
  const checkRequest = new sql.Request(pool)
  checkRequest.input('AccountID', sql.Int, args.accountId)
  checkRequest.input('ChecklistRunID', sql.BigInt, args.runId)

  const checkResult = await checkRequest.query<{
    Status: string
  }>(`
    SELECT Status
    FROM dbo.ChecklistRuns
    WHERE AccountID = @AccountID
      AND ChecklistRunID = @ChecklistRunID;
  `)

  if (checkResult.recordset.length === 0) {
    return { exists: false, updatedRows: 0 }
  }

  const currentStatus = checkResult.recordset[0]!.Status as ChecklistRunStatus

  // Validate status transition
  if (args.input.status) {
    const newStatus = args.input.status

    // No transitions out of COMPLETED or CANCELLED
    if (currentStatus === 'COMPLETED' || currentStatus === 'CANCELLED') {
      throw new AppError(`Cannot change status of ${currentStatus} checklist run`, 400)
    }

    // Only allow IN_PROGRESS -> CANCELLED transition
    if (newStatus === 'CANCELLED' && currentStatus !== 'IN_PROGRESS') {
      throw new AppError('Can only cancel IN_PROGRESS checklist runs', 400)
    }

    // Block invalid transitions
    if (newStatus === 'DRAFT' || newStatus === 'IN_PROGRESS') {
      throw new AppError('Status transitions to DRAFT or IN_PROGRESS are automatic', 400)
    }
  }

  const updateRequest = new sql.Request(pool)
  updateRequest.input('AccountID', sql.Int, args.accountId)
  updateRequest.input('ChecklistRunID', sql.BigInt, args.runId)

  const setClauses: string[] = []

  if (args.input.status) {
    updateRequest.input('Status', sql.NVarChar(16), args.input.status)
    setClauses.push('Status = @Status')

    if (args.input.status === 'CANCELLED') {
      setClauses.push('UpdatedAt = SYSUTCDATETIME()')
    }
  } else {
    setClauses.push('UpdatedAt = SYSUTCDATETIME()')
  }

  const sqlText = `
    UPDATE dbo.ChecklistRuns
    SET ${setClauses.join(', ')}
    WHERE AccountID = @AccountID
      AND ChecklistRunID = @ChecklistRunID;
  `

  const result = await updateRequest.query(sqlText)

  const rowsAffectedArray = (result as { rowsAffected?: number[] }).rowsAffected ?? []
  const rowsAffected = rowsAffectedArray.reduce((sum, value) => sum + value, 0)

  return { exists: true, updatedRows: rowsAffected }
}

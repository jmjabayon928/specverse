import { poolPromise, sql } from '@/backend/config/db'
import { AppError } from '@/backend/errors/AppError'
import type {
  ChecklistRunDTO,
  ChecklistRunEntryPatchInput,
  ChecklistRunEntryResult,
  CreateChecklistRunInput,
  CreateChecklistRunResult,
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

export const createChecklistRunWithEntries = async (
  args: CreateChecklistRunRepositoryArgs,
): Promise<CreateChecklistRunResult> => {
  const pool = await poolPromise
  const transaction = new sql.Transaction(pool)

  await transaction.begin()

  try {
    const insertRunRequest = new sql.Request(transaction)

    insertRunRequest.input('AccountID', sql.Int, args.accountId)
    insertRunRequest.input('ChecklistTemplateID', sql.Int, args.checklistTemplateId)
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
        RunName,
        Notes,
        ProjectID,
        FacilityID,
        SystemID,
        AssetID,
        Status,
        CreatedAt,
        CreatedBy
      )
      OUTPUT inserted.ChecklistRunID
      VALUES (
        @AccountID,
        @ChecklistTemplateID,
        @RunName,
        @Notes,
        @ProjectID,
        @FacilityID,
        @SystemID,
        @AssetID,
        'DRAFT',
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
  RunName: string
  Notes: string | null
  ProjectID: number | null
  FacilityID: number | null
  SystemID: number | null
  AssetID: number | null
  Status: string
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

interface ChecklistRunEntryAttachmentRow {
  ChecklistRunEntryID: number | bigint
  AttachmentID: number
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

export const getChecklistRun = async (
  accountId: number,
  runId: number,
): Promise<ChecklistRunDTO | null> => {
  const pool = await poolPromise

  const headerRequest = new sql.Request(pool)
  headerRequest.input('AccountID', sql.Int, accountId)
  headerRequest.input('ChecklistRunID', sql.BigInt, runId)

  const headerResult = await headerRequest.query<ChecklistRunHeaderRow>(`
    SELECT
      ChecklistRunID,
      ChecklistTemplateID,
      RunName,
      Notes,
      ProjectID,
      FacilityID,
      SystemID,
      AssetID,
      Status
    FROM dbo.ChecklistRuns
    WHERE AccountID = @AccountID
      AND ChecklistRunID = @ChecklistRunID;
  `)

  const header = headerResult.recordset[0]

  if (!header) {
    return null
  }

  const entriesRequest = new sql.Request(pool)
  entriesRequest.input('AccountID', sql.Int, accountId)
  entriesRequest.input('ChecklistRunID', sql.BigInt, runId)

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
    ORDER BY SortOrder, ChecklistRunEntryID;
  `)

  const runEntryIds = entriesResult.recordset.map(row => Number(row.ChecklistRunEntryID))

  const attachmentsByEntry = new Map<number, number[]>()
  const attachmentsMetaByEntry = new Map<number, ChecklistRunEntryAttachmentMetaRow[]>()

  if (runEntryIds.length > 0) {
    const attachmentsRequest = new sql.Request(pool)
    attachmentsRequest.input('AccountID', sql.Int, accountId)
    attachmentsRequest.input('ChecklistRunID', sql.BigInt, runId)

    const attachmentsResult = await attachmentsRequest.query<ChecklistRunEntryAttachmentRow>(`
      SELECT
        cre.ChecklistRunEntryID,
        rea.AttachmentID
      FROM dbo.ChecklistRunEntryAttachments rea
      INNER JOIN dbo.ChecklistRunEntries cre
        ON cre.ChecklistRunEntryID = rea.ChecklistRunEntryID
      WHERE cre.AccountID = @AccountID
        AND cre.ChecklistRunID = @ChecklistRunID;
    `)

    for (const row of attachmentsResult.recordset) {
      const entryId = Number(row.ChecklistRunEntryID)
      const list = attachmentsByEntry.get(entryId) ?? []
      list.push(row.AttachmentID)
      attachmentsByEntry.set(entryId, list)
    }

    const attachmentsMetaRequest = new sql.Request(pool)
    attachmentsMetaRequest.input('AccountID', sql.Int, accountId)
    attachmentsMetaRequest.input('ChecklistRunID', sql.BigInt, runId)

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
          AND cre.ChecklistRunID = @ChecklistRunID;
      `)

    for (const row of attachmentsMetaResult.recordset) {
      const entryId = Number(row.ChecklistRunEntryID)
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
    runName: header.RunName,
    notes: header.Notes,
    projectId: header.ProjectID,
    facilityId: header.FacilityID,
    systemId: header.SystemID,
    assetId: header.AssetID,
    status: header.Status,
    entries,
  }

  return dto
}

export const patchChecklistRunEntry = async (
  accountId: number,
  _userId: number,
  runEntryId: number,
  input: ChecklistRunEntryPatchInput,
): Promise<{ exists: boolean; updatedRows: number }> => {
  const pool = await poolPromise
  const selectRequest = new sql.Request(pool)

  selectRequest.input('AccountID', sql.Int, accountId)
  selectRequest.input('ChecklistRunEntryID', sql.BigInt, runEntryId)

  const existing = await selectRequest.query<{ RowVersion: Buffer | Uint8Array }>(`
    SELECT RowVersion
    FROM dbo.ChecklistRunEntries
    WHERE AccountID = @AccountID
      AND ChecklistRunEntryID = @ChecklistRunEntryID;
  `)

  if (existing.recordset.length === 0) {
    return { exists: false, updatedRows: 0 }
  }

  const request = new sql.Request(pool)

  request.input('AccountID', sql.Int, accountId)
  request.input('ChecklistRunEntryID', sql.BigInt, runEntryId)

  const setClauses: string[] = []

  if (input.result !== undefined) {
    request.input('Result', sql.NVarChar(16), input.result)
    setClauses.push('Result = @Result')
  }

  if (input.notes !== undefined) {
    request.input('Notes', sql.NVarChar(4000), input.notes)
    setClauses.push('Notes = @Notes')
  }

  if (input.measuredValue !== undefined) {
    request.input('MeasuredValue', sql.NVarChar(255), input.measuredValue)
    setClauses.push('MeasuredValue = @MeasuredValue')
  }

  if (input.uom !== undefined) {
    request.input('Uom', sql.NVarChar(64), input.uom)
    setClauses.push('Uom = @Uom')
  }

  if (setClauses.length === 0) {
    return { exists: true, updatedRows: 0 }
  }

  const expectedRowVersionBase64 = input.expectedRowVersionBase64
  const expectedRowVersionBuffer =
    typeof Buffer !== 'undefined'
      ? Buffer.from(expectedRowVersionBase64, 'base64')
      : expectedRowVersionBase64

  request.input('ExpectedRowVersion', sql.VarBinary(8), expectedRowVersionBuffer)

  const sqlText = `
    UPDATE dbo.ChecklistRunEntries
    SET ${setClauses.join(', ')}
    WHERE AccountID = @AccountID
      AND ChecklistRunEntryID = @ChecklistRunEntryID
      AND RowVersion = @ExpectedRowVersion;
  `

  const result = await request.query(sqlText)

  const rowsAffectedArray = (result as { rowsAffected?: number[] }).rowsAffected ?? []
  const rowsAffected = rowsAffectedArray.reduce((sum, value) => sum + value, 0)

  return { exists: true, updatedRows: rowsAffected }
}


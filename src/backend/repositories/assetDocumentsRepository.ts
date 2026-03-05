import { type ConnectionPool, type IResult, NVarChar, Int } from 'mssql'
import { AppError } from '@/backend/errors/AppError'

const RELATION_TYPE_ASSET_DOCUMENT = 'AssetDocument'
const FROM_ENTITY_NAME_ASSET = 'Asset'
const TO_ENTITY_NAME_ATTACHMENT = 'Attachment'

// Local helper to escape LIKE wildcards consistent with other repos
function escapeLike(s: string): string {
  return s.replace(/[%_[\]\\]/g, '\\$&')
}

export type AssetDocumentRow = {
  attachmentId: number
  filename: string
  contentType: string
  filesize: number
  uploadedAt: string // ISO string for consistency
  uploadedBy: number
  // Add any other relevant columns from dbo.Attachments if needed by UI
}

export async function listAssetDocuments({
  pool,
  accountId,
  assetId,
  q,
  take,
  skip,
}: {
  pool: ConnectionPool
  accountId: number
  assetId: number
  q?: string
  take: number
  skip: number
}): Promise<{ items: AssetDocumentRow[]; total: number }> {
  const request = pool.request()
  request.input('AccountID', Int, accountId)
  request.input('AssetID', Int, assetId)
  request.input('Take', Int, take)
  request.input('Skip', Int, skip)

  let query = `
    SELECT
      a.AttachmentID AS attachmentId,
      a.Filename AS filename,
      a.ContentType AS contentType,
      a.Filesize AS filesize,
      a.UploadedAt AS uploadedAt,
      a.UploadedBy AS uploadedBy,
      COUNT(*) OVER() AS TotalCount
    FROM EntityLinks el
    JOIN Attachments a ON el.ToRecordID = a.AttachmentID
    WHERE el.FromEntityName = @FromEntityName
      AND el.FromRecordID = @AssetID
      AND el.ToEntityName = @ToEntityName
      AND el.RelationType = @RelationType
      AND a.AccountID = @AccountID
  `
  request.input('FromEntityName', NVarChar(50), FROM_ENTITY_NAME_ASSET)
  request.input('ToEntityName', NVarChar(50), TO_ENTITY_NAME_ATTACHMENT)
  request.input('RelationType', NVarChar(50), RELATION_TYPE_ASSET_DOCUMENT)

  if (q) {
    const escapedQ = escapeLike(q)
    query += ` AND (a.Filename LIKE @Q ESCAPE '\' OR a.OriginalName LIKE @Q ESCAPE '\' )` // Assuming OriginalName exists in Attachments
    request.input('Q', NVarChar(200), `%${escapedQ}%`)
  }

  query += `
    ORDER BY a.UploadedAt DESC
    OFFSET @Skip ROWS FETCH NEXT @Take ROWS ONLY;
  `
  const result: IResult<AssetDocumentRow & { TotalCount: number }> = await request.query(query)

  const total = result.recordset[0]?.TotalCount ?? 0
  const items = result.recordset.map(row => ({
    attachmentId: row.attachmentId,
    filename: row.filename,
    contentType: row.contentType,
    filesize: row.filesize,
    uploadedAt: new Date(row.uploadedAt).toISOString(),
    uploadedBy: row.uploadedBy,
  }))

  return { items, total }
}

export async function addAssetDocumentLink({
  pool,
  accountId,
  assetId,
  attachmentId,
  userId,
}: {
  pool: ConnectionPool
  accountId: number
  assetId: number
  attachmentId: number
  userId: number
}): Promise<void> {
  const request = pool.request()
  request.input('AccountID', Int, accountId)
  request.input('AssetID', Int, assetId)
  request.input('AttachmentID', Int, attachmentId)
  request.input('UserID', Int, userId) // CreatedBy is userId

  // Check if attachment exists and belongs to the account
  const attachmentCheck = await request.query<{ AttachmentID: number }>(`
    SELECT AttachmentID FROM Attachments WHERE AttachmentID = @AttachmentID AND AccountID = @AccountID
  `)
  if (attachmentCheck.recordset.length === 0) {
    throw new AppError('Attachment not found or does not belong to this account', 404)
  }

  // Check if link already exists (idempotent behavior)
  const existingLink = await request.query<{ EntityLinkID: number }>(`
    SELECT EntityLinkID
    FROM EntityLinks
    WHERE FromEntityName = @FromEntityName
      AND FromRecordID = @AssetID
      AND ToEntityName = @ToEntityName
      AND ToRecordID = @AttachmentID
      AND RelationType = @RelationType
  `)
  if (existingLink.recordset.length > 0) {
    // Link already exists, do nothing (idempotent)
    return
  }

  await request.query(`
    INSERT INTO EntityLinks (FromEntityName, FromRecordID, ToEntityName, ToRecordID, RelationType, CreatedBy)
    VALUES (@FromEntityName, @AssetID, @ToEntityName, @AttachmentID, @RelationType, @UserID)
  `)
}

export async function removeAssetDocumentLink({
  pool,
  accountId,
  assetId,
  attachmentId,
}: {
  pool: ConnectionPool
  accountId: number
  assetId: number
  attachmentId: number
}): Promise<void> {
  const request = pool.request()
  request.input('AccountID', Int, accountId)
  request.input('AssetID', Int, assetId)
  request.input('AttachmentID', Int, attachmentId)

  const result = await request.query(`
    DELETE el
    FROM EntityLinks el
    JOIN Attachments a ON el.ToRecordID = a.AttachmentID
    WHERE el.FromEntityName = @FromEntityName
      AND el.FromRecordID = @AssetID
      AND el.ToEntityName = @ToEntityName
      AND el.ToRecordID = @AttachmentID
      AND el.RelationType = @RelationType
      AND a.AccountID = @AccountID;
  `)
  if (result.rowsAffected[0] === 0) {
    throw new AppError('Document link not found or does not belong to this asset/account', 404)
  }
}

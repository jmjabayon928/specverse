import { poolPromise, sql } from "@/backend/config/db";
import { HttpError } from "@/utils/errors";

export type DBAttachmentRow = {
  // From Attachments
  AttachmentID: number;
  OriginalName: string;
  StoredName: string;
  ContentType: string;
  FileSizeBytes: number;
  StorageProvider: string;
  StoragePath: string;
  Sha256: string | null;
  UploadedBy: number | null;
  UploadedAt: Date;
  Version: number;
  IsViewable: number;

  // From SheetAttachments (when joined)
  SheetAttachmentID?: number;
  SheetID?: number;
  OrderIndex?: number;
  IsFromTemplate?: boolean;
  LinkedFromSheetID?: number | null;
  CloneOnCreate?: boolean;
  SA_CreatedAt?: Date;
};

export type CreateFileMeta = {
  storedName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: number | null;
  orderIndex?: number | null;
  // optional hashing if you compute it; can be null
  sha256?: string | null;
};

async function assertSheetExists(sheetId: number) {
  const pool = await poolPromise;
  const r = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT 1 AS ok FROM dbo.Sheets WHERE SheetID = @SheetID`);
  if (!r.recordset?.length) throw new HttpError(404, "Sheet not found.");
}

async function assertSheetEditable(sheetId: number) {
  const pool = await poolPromise;
  const r = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT Status FROM dbo.Sheets WHERE SheetID = @SheetID`);
  if (!r.recordset?.length) throw new HttpError(404, "Sheet not found.");
  const status = String(r.recordset[0].Status ?? "").toUpperCase();
  if (status === "VERIFIED" || status === "APPROVED") {
    throw new HttpError(409, "Sheet is locked (Verified/Approved); attachments cannot be changed.");
  }
}

/** List all attachments linked to a sheet (ordered by OrderIndex then AttachmentID) */
export async function getAttachmentsBySheet(sheetId: number): Promise<DBAttachmentRow[]> {
  if (!Number.isFinite(sheetId) || sheetId <= 0) return [];
  const pool = await poolPromise;
  const q = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT 
        sa.SheetAttachmentID, sa.SheetID, sa.OrderIndex, sa.IsFromTemplate, sa.LinkedFromSheetID,
        sa.CloneOnCreate, sa.CreatedAt AS SA_CreatedAt,
        a.AttachmentID, a.OriginalName, a.StoredName, a.ContentType, a.FileSizeBytes,
        a.StorageProvider, a.StoragePath, a.Sha256, a.UploadedBy, a.UploadedAt, a.Version, a.IsViewable
      FROM dbo.SheetAttachments sa
      JOIN dbo.Attachments a ON a.AttachmentID = sa.AttachmentID
      WHERE sa.SheetID = @SheetID
      ORDER BY sa.OrderIndex ASC, a.AttachmentID DESC;
    `);
  return q.recordset as DBAttachmentRow[];
}

/** Insert a new attachment + link it to the sheet. Returns the full row. */
export async function insertAttachmentForSheet(
  sheetId: number,
  meta: CreateFileMeta
): Promise<DBAttachmentRow> {
  await assertSheetEditable(sheetId);

  const {
    storedName,
    originalName,
    mimeType,
    sizeBytes,
    uploadedBy = null,
    orderIndex = null,
    sha256 = null,
  } = meta;

  if (!storedName || !originalName) {
    throw new HttpError(400, "Invalid file metadata.");
  }

  // derive fields required by your schema
  const storageProvider = "local";
  const storagePath = storedName; // store relative path; adjust if you place files in subfolders
  const version = 1;
  const isViewable = isViewableMime(mimeType) ? 1 : 0;

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const req = new sql.Request(tx);

    // Insert into Attachments
    const ins = await req
      .input("OriginalName", sql.NVarChar(255), originalName)
      .input("StoredName", sql.NVarChar(255), storedName)
      .input("ContentType", sql.NVarChar(120), mimeType || "application/octet-stream")
      .input("FileSizeBytes", sql.BigInt, sizeBytes ?? 0)
      .input("StorageProvider", sql.VarChar(30), storageProvider)
      .input("StoragePath", sql.NVarChar(500), storagePath)
      .input("Sha256", sql.Char(64), sha256)
      .input("UploadedBy", sql.Int, uploadedBy)
      // UploadedAt is NOT NULL -> set in SQL via SYSUTCDATETIME()
      .input("Version", sql.Int, version)
      .input("IsViewable", sql.Int, isViewable)
      .query(`
        INSERT INTO dbo.Attachments
          (OriginalName, StoredName, ContentType, FileSizeBytes,
           StorageProvider, StoragePath, Sha256, UploadedBy, UploadedAt,
           Version, IsViewable)
        VALUES
          (@OriginalName, @StoredName, @ContentType, @FileSizeBytes,
           @StorageProvider, @StoragePath, @Sha256, @UploadedBy, SYSUTCDATETIME(),
           @Version, @IsViewable);

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS NewID;
      `);

    const newId: number | undefined = ins.recordset?.[0]?.NewID;
    if (!Number.isFinite(newId)) throw new HttpError(500, "Failed to create attachment.");

    // Insert link into SheetAttachments
    await req
      .input("SheetID", sql.Int, sheetId)
      .input("AttachmentID", sql.Int, newId)
      .input("OrderIndex", sql.Int, orderIndex)
      .query(`
        INSERT INTO dbo.SheetAttachments
          (SheetID, AttachmentID, OrderIndex, IsFromTemplate, LinkedFromSheetID, CloneOnCreate, CreatedAt)
        VALUES
          (
            @SheetID,
            @AttachmentID,
            COALESCE(@OrderIndex, (SELECT ISNULL(MAX(sa.OrderIndex), -1) + 1 FROM dbo.SheetAttachments sa WITH (UPDLOCK, HOLDLOCK) WHERE sa.SheetID = @SheetID)),
            0, NULL, 0, SYSUTCDATETIME()
          );
      `);

    // Return full row
    const sel = await req
      .input("AttachmentID", sql.Int, newId)
      .input("SheetID", sql.Int, sheetId)
      .query(`
        SELECT 
          sa.SheetAttachmentID, sa.SheetID, sa.OrderIndex, sa.IsFromTemplate, sa.LinkedFromSheetID,
          sa.CloneOnCreate, sa.CreatedAt AS SA_CreatedAt,
          a.AttachmentID, a.OriginalName, a.StoredName, a.ContentType, a.FileSizeBytes,
          a.StorageProvider, a.StoragePath, a.Sha256, a.UploadedBy, a.UploadedAt, a.Version, a.IsViewable
        FROM dbo.SheetAttachments sa
        JOIN dbo.Attachments a ON a.AttachmentID = sa.AttachmentID
        WHERE sa.SheetID = @SheetID AND sa.AttachmentID = @AttachmentID;
      `);

    await tx.commit();
    return sel.recordset[0] as DBAttachmentRow;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

/** Delete link; if orphan, delete attachment record and tell caller to remove file on disk */
export async function deleteAttachmentFromSheet(
  sheetId: number,
  attachmentId: number
): Promise<{ orphaned: boolean; storedName?: string }> {
  await assertSheetEditable(sheetId);
  await assertSheetExists(sheetId);

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const req = new sql.Request(tx);

    const del = await req
      .input("SheetID", sql.Int, sheetId)
      .input("AttachmentID", sql.Int, attachmentId)
      .query(`
        DELETE sa
        FROM dbo.SheetAttachments sa
        WHERE sa.SheetID = @SheetID AND sa.AttachmentID = @AttachmentID;

        SELECT @@ROWCOUNT AS Affected;
      `);

    const affected: number = del.recordset?.[0]?.Affected ?? 0;
    if (affected === 0) {
      await tx.rollback();
      throw new HttpError(404, "Attachment link not found for this sheet.");
    }

    const cnt = await req
      .input("AttachmentID", sql.Int, attachmentId)
      .query(`SELECT COUNT(*) AS Cnt FROM dbo.SheetAttachments WHERE AttachmentID = @AttachmentID`);
    const remaining = Number(cnt.recordset?.[0]?.Cnt ?? 0);

    if (remaining === 0) {
      const sel = await req
        .input("AttachmentID", sql.Int, attachmentId)
        .query(`SELECT StoredName FROM dbo.Attachments WHERE AttachmentID = @AttachmentID`);
      const storedName: string | undefined = sel.recordset?.[0]?.StoredName;

      await req
        .input("AttachmentID", sql.Int, attachmentId)
        .query(`DELETE FROM dbo.Attachments WHERE AttachmentID = @AttachmentID`);

      await tx.commit();
      return { orphaned: true, storedName };
    }

    await tx.commit();
    return { orphaned: false };
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function getAttachmentById(attachmentId: number): Promise<DBAttachmentRow | null> {
  if (!Number.isFinite(attachmentId) || attachmentId <= 0) return null;
  const pool = await poolPromise;
  const q = await pool.request()
    .input("AttachmentID", sql.Int, attachmentId)
    .query(`
      SELECT 
        a.AttachmentID, a.OriginalName, a.StoredName, a.ContentType, a.FileSizeBytes,
        a.StorageProvider, a.StoragePath, a.Sha256, a.UploadedBy, a.UploadedAt, a.Version, a.IsViewable
      FROM dbo.Attachments a
      WHERE a.AttachmentID = @AttachmentID
    `);
  return (q.recordset?.[0] as DBAttachmentRow) ?? null;
}

/* ---------- helpers ---------- */

function isViewableMime(m: string): boolean {
  const mm = (m || "").toLowerCase();
  return mm.startsWith("image/") || mm === "application/pdf";
}

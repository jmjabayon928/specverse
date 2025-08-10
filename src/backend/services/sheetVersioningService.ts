// src/backend/services/sheetVersioningService.ts
import { poolPromise, sql } from "@/backend/config/db";
import { HttpError } from "@/utils/errors";

export type LinkPolicy = "link" | "clone";

type DuplicateArgs = {
  sourceId: number;
  userId: number;
  isTemplate: boolean;
  linkPolicy?: LinkPolicy;       // "link" (default) or "clone"
};

type RevisionArgs = {
  sourceId: number;
  userId: number;
  isTemplate: boolean;
  linkPolicy?: LinkPolicy;       // "link" (default) or "clone"
};

function assertValidId(id: number, name = "id") {
  if (!Number.isFinite(id) || id <= 0) throw new HttpError(400, `Invalid ${name}`);
}

export async function duplicateSheet(args: DuplicateArgs): Promise<number> {
  const { sourceId, userId, isTemplate, linkPolicy = "link" } = args;
  assertValidId(sourceId, "sourceId");

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const req = new sql.Request(tx);

    // Load source row
    const src = await req
      .input("SourceID", sql.Int, sourceId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Sheets WITH (READCOMMITTEDLOCK)
        WHERE SheetID = @SourceID
      `);

    if (!src.recordset?.length) throw new HttpError(404, "Source sheet not found");
    //const sourceRow = src.recordset[0];

    // Business rules:
    const newStatus = "Draft"; 
    const newRevisionNum = 0; 
    const parentSheetId: number | null = null; 

    // If policy requires doc numbers to be unique, blank them on duplicate:
    const blankDocNumbers = true;

    // REVIEW: Adjust the column list below to match your dbo.Sheets schema.
    // Do not include identity columns (SheetID) or rowversion, etc.
    // Keep preparedById as either the original or current user per policy; here we keep original.
    const insert = await req
      .input("IsTemplate", sql.Bit, isTemplate ? 1 : 0)
      .input("NewStatus", sql.VarChar(30), newStatus)
      .input("NewRev", sql.Int, newRevisionNum)
      .input("ParentID", sql.Int, parentSheetId)
      .input("UserID", sql.Int, userId)
      .query(`
        DECLARE @NewSheetID INT;

        INSERT INTO dbo.Sheets (
          -- REVIEW: BEGIN column list you keep
          IsTemplate,
          Status,
          RevisionNum,
          ParentSheetID,

          AreaID, ManuID, SuppID, CategoryID, ClientID, ProjectID, PID,

          ClientDocNum, ClientProjectNum, CompanyDocNum, CompanyProjectNum,

          EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
          InstallPackNum, EquipSize, ModelNum, Driver, LocationDWG, InstallDWG, CodeStd,

          SheetName, SheetDesc, SheetDesc2,

          PreparedByID, PreparedByDate,

          ModifiedByID, ModifiedByDate,
          RejectedByID, RejectedByDate, RejectComment,
          VerifiedByID, VerifiedDate,
          ApprovedByID, ApprovedDate,

          ClientLogo,
          PackageName,
          IsSuperseded
          -- REVIEW: END column list
        )
        SELECT
          @IsTemplate,
          @NewStatus,
          @NewRev,
          NULL,                      -- ParentSheetID

          AreaID, ManuID, SuppID, CategoryID, ClientID, ProjectID, PID,

          ${blankDocNumbers ? "NULL, NULL, NULL, NULL" : "ClientDocNum, ClientProjectNum, CompanyDocNum, CompanyProjectNum"},

          EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
          InstallPackNum, EquipSize, ModelNum, Driver, LocationDWG, InstallDWG, CodeStd,

          SheetName, SheetDesc, SheetDesc2,

          PreparedByID, PreparedByDate,

          NULL, NULL,                 -- ModifiedByID/Date cleared
          NULL, NULL, NULL,           -- RejectedByID/Date/Comment cleared
          NULL, NULL,                 -- VerifiedByID/Date cleared
          NULL, NULL,                 -- ApprovedByID/Date cleared

          ClientLogo,
          PackageName,
          0                           -- IsSuperseded
        FROM dbo.Sheets
        WHERE SheetID = @SourceID;

        SET @NewSheetID = CAST(SCOPE_IDENTITY() AS INT);

        -- Copy notes to new sheet
        INSERT INTO dbo.SheetNotes (SheetID, NoteTypeID, NoteText, OrderIndex, CreatedBy)
        SELECT
          @NewSheetID, NoteTypeID, NoteText, OrderIndex, @UserID
        FROM dbo.SheetNotes
        WHERE SheetID = @SourceID;

        -- Link attachments to new sheet (link policy)
        INSERT INTO dbo.SheetAttachments
          (SheetID, AttachmentID, OrderIndex, IsFromTemplate, LinkedFromSheetID, CloneOnCreate, CreatedAt)
        SELECT
          @NewSheetID, sa.AttachmentID, sa.OrderIndex,
          CASE WHEN s.IsTemplate = 1 THEN 1 ELSE 0 END,
          @SourceID,
          CASE WHEN ${linkPolicy === "clone" ? "1" : "0"} = 1 THEN 1 ELSE 0 END,
          SYSUTCDATETIME()
        FROM dbo.SheetAttachments sa
        JOIN dbo.Sheets s ON s.SheetID = sa.SheetID
        WHERE sa.SheetID = @SourceID;

        SELECT @NewSheetID AS NewSheetID;
      `);

    const newId: number | undefined = insert.recordset?.[0]?.NewSheetID;
    if (!newId) throw new HttpError(500, "Failed to create duplicate");

    await tx.commit();
    return newId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function createRevision(args: RevisionArgs): Promise<number> {
  const { sourceId, userId, isTemplate, linkPolicy = "link" } = args;
  assertValidId(sourceId, "sourceId");

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    const req = new sql.Request(tx);

    // Load + validate status
    const src = await req
      .input("SourceID", sql.Int, sourceId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Sheets WITH (READCOMMITTEDLOCK)
        WHERE SheetID = @SourceID
      `);

    if (!src.recordset?.length) throw new HttpError(404, "Source sheet not found");
    const s = src.recordset[0] as { Status?: string; RevisionNum?: number };

    const status = String(s.Status ?? "");
    const allowed = status === "Verified" || status === "Approved";
    if (!allowed) throw new HttpError(409, "Create Revision allowed only from Verified/Approved");

    const newStatus = "Modified Draft";     // Your agreed policy for revisions
    const newRevisionNum = (s.RevisionNum ?? 0) + 1;
    const parentSheetId = sourceId;

    // Policy: Revisions typically keep doc numbers (same doc #, higher rev)
    const keepDocNumbers = true;

    const insert = await req
      .input("IsTemplate", sql.Bit, isTemplate ? 1 : 0)
      .input("NewStatus", sql.VarChar(30), newStatus)
      .input("NewRev", sql.Int, newRevisionNum)
      .input("ParentID", sql.Int, parentSheetId)
      .input("UserID", sql.Int, userId)
      .query(`
        DECLARE @NewSheetID INT;

        INSERT INTO dbo.Sheets (
          -- REVIEW: BEGIN column list you keep
          IsTemplate,
          Status,
          RevisionNum,
          ParentSheetID,

          AreaID, ManuID, SuppID, CategoryID, ClientID, ProjectID, PID,

          ClientDocNum, ClientProjectNum, CompanyDocNum, CompanyProjectNum,

          EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
          InstallPackNum, EquipSize, ModelNum, Driver, LocationDWG, InstallDWG, CodeStd,

          SheetName, SheetDesc, SheetDesc2,

          PreparedByID, PreparedByDate,

          ModifiedByID, ModifiedByDate,
          RejectedByID, RejectedByDate, RejectComment,
          VerifiedByID, VerifiedDate,
          ApprovedByID, ApprovedDate,

          ClientLogo,
          PackageName,
          IsSuperseded
          -- REVIEW: END column list
        )
        SELECT
          @IsTemplate,
          @NewStatus,
          @NewRev,
          @ParentID,

          AreaID, ManuID, SuppID, CategoryID, ClientID, ProjectID, PID,

          ${keepDocNumbers ? "ClientDocNum, ClientProjectNum, CompanyDocNum, CompanyProjectNum" : "NULL, NULL, NULL, NULL"},

          EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
          InstallPackNum, EquipSize, ModelNum, Driver, LocationDWG, InstallDWG, CodeStd,

          SheetName, SheetDesc, SheetDesc2,

          PreparedByID, PreparedByDate,

          NULL, NULL,                 -- Modified cleared
          NULL, NULL, NULL,           -- Rejected cleared
          NULL, NULL,                 -- Verified cleared
          NULL, NULL,                 -- Approved cleared

          ClientLogo,
          PackageName,
          0                           -- new revision is current
        FROM dbo.Sheets
        WHERE SheetID = @SourceID;

        SET @NewSheetID = CAST(SCOPE_IDENTITY() AS INT);

        -- Mark source as superseded
        UPDATE dbo.Sheets SET IsSuperseded = 1 WHERE SheetID = @SourceID;

        -- Copy notes
        INSERT INTO dbo.SheetNotes (SheetID, NoteTypeID, NoteText, OrderIndex, CreatedBy)
        SELECT
          @NewSheetID, NoteTypeID, NoteText, OrderIndex, @UserID
        FROM dbo.SheetNotes
        WHERE SheetID = @SourceID;

        -- Link attachments (usually link on revision)
        INSERT INTO dbo.SheetAttachments
          (SheetID, AttachmentID, OrderIndex, IsFromTemplate, LinkedFromSheetID, CloneOnCreate, CreatedAt)
        SELECT
          @NewSheetID, sa.AttachmentID, sa.OrderIndex,
          CASE WHEN s.IsTemplate = 1 THEN 1 ELSE 0 END,
          @SourceID,
          CASE WHEN ${linkPolicy === "clone" ? "1" : "0"} = 1 THEN 1 ELSE 0 END,
          SYSUTCDATETIME()
        FROM dbo.SheetAttachments sa
        JOIN dbo.Sheets s ON s.SheetID = sa.SheetID
        WHERE sa.SheetID = @SourceID;

        SELECT @NewSheetID AS NewSheetID;
      `);

    const newId: number | undefined = insert.recordset?.[0]?.NewSheetID;
    if (!newId) throw new HttpError(500, "Failed to create revision");

    await tx.commit();
    return newId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

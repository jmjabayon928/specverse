// src/backend/services/templateService.ts

import { poolPromise, sql } from "../config/db";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { 
  UnifiedSheet, 
  UnifiedSubsheet, 
  InfoField,
  SheetNoteDTO,
  NoteType,
  NoteUpdatePayload,
  SheetAttachmentDTO,
  AddSheetAttachmentArgs,
  AddSheetAttachmentResult,
} from "@/domain/datasheets/sheetTypes";
import type { 
  TemplateStructure, 
  TemplateSubsheet, 
  TemplateField 
} from "@/domain/datasheets/sheetTypes";
import { insertAuditLog } from "../database/auditQueries";
import { notifyUsers } from "../utils/notifyUsers";
import { getSheetTranslations } from "@/backend/services/translationService";
import { applySheetTranslations } from "@/utils/applySheetTranslations";
import { convertToUSC } from "@/utils/unitConversionTable";
import { generateDatasheetPDF } from "@/utils/generateDatasheetPDF";
import { generateDatasheetExcel } from "@/utils/generateDatasheetExcel";

type UOM = "SI" | "USC";

type TemplateDetailsWithDatasheet = { datasheet: UnifiedSheet }; 

function hasDatasheet(obj: unknown): obj is TemplateDetailsWithDatasheet {
  return !!obj && typeof obj === "object" && "datasheet" in obj;
}

async function exists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}
async function normalizeToPath(res: unknown, outPath: string): Promise<string> {
  if (
    res != null &&
    typeof res === "object" &&
    "buffer" in (res as Record<string, unknown>) &&
    Buffer.isBuffer((res as { buffer?: unknown }).buffer)
  ) {
    const buf = (res as { buffer: Buffer }).buffer;
    await fs.writeFile(outPath, buf);
    return outPath;
  }
  if (Buffer.isBuffer(res)) {
    await fs.writeFile(outPath, res);
    return outPath;
  }
  if (typeof res === "string") {
    const abs = path.isAbsolute(res) ? res : path.resolve(process.cwd(), res);
    if (await exists(abs)) return abs;
    await fs.writeFile(outPath, Buffer.alloc(0));
    return outPath;
  }
  if (!(await exists(outPath))) {
    throw new Error(`Template export generator did not create file: ${outPath}`);
  }
  return outPath;
}

function isUnifiedSheetLike(obj: unknown): obj is UnifiedSheet {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  const subs = (o as { subsheets?: unknown }).subsheets;
  return Array.isArray(subs);
}

function toDatasheetLikeFromTemplate(template: unknown): UnifiedSheet {
  if (isUnifiedSheetLike(template)) {
    return template; // already shaped like UnifiedSheet
  }
  throw new Error("Template export expected a datasheet-like payload but none was found.");
}

// Small coercers you likely already have; keep them where you define them:
const isBlank = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

const nv = (v: unknown): string | null =>
  isBlank(v) ? null : String(v);

const iv = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function isViewableMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return m.startsWith("image/") || m === "application/pdf";
}

async function sha256File(absPath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(absPath);
    const hash = crypto.createHash("sha256").update(buf).digest("hex");
    return hash;
  } catch {
    return null;
  }
}

// Try each SQL variant until one succeeds (avoids hard-coding 1 schema)
export async function fetchTemplateStructure(sheetId: number): Promise<TemplateStructure> {
  const pool = await poolPromise;

  // Local helpers (scoped to this function)
  const parseIntish = (v: unknown): number | undefined => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
    return undefined;
  };
  const asNonEmptyString = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v : undefined;

  // ── SubSheets for this SheetID
  const subsheetsRs = await pool
    .request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT
        s.SubID   AS id,
        s.SubName AS name
      FROM SubSheets s
      WHERE s.SheetID = @SheetID
      ORDER BY s.OrderIndex, s.SubID
    `);

  const subsheets: TemplateSubsheet[] = [];
  for (const row of subsheetsRs.recordset as unknown[]) {
    const rec = (row ?? {}) as Record<string, unknown>;
    const id = parseIntish(rec.id);
    let name = asNonEmptyString(rec.name);
    if (!name && id !== undefined) {
      name = `Subsheet ${id}`;
    }
    if (id !== undefined && name !== undefined) {
      subsheets.push({ id, name });
    }
  }

  // ── InformationTemplates for this SheetID (via SubSheets)
  const fieldsRs = await pool
    .request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT
        it.InfoTemplateID AS id,
        it.Label          AS label,
        it.SubID          AS subId
      FROM InformationTemplates it
      INNER JOIN SubSheets s ON s.SubID = it.SubID
      WHERE s.SheetID = @SheetID
      ORDER BY it.OrderIndex, it.InfoTemplateID
    `);

  const fields: TemplateField[] = [];
  for (const row of fieldsRs.recordset as unknown[]) {
    const rec = (row ?? {}) as Record<string, unknown>;
    const id = parseIntish(rec.id);
    let label = asNonEmptyString(rec.label);
    const subIdRaw = parseIntish(rec.subId);
    const subId = subIdRaw ?? null;

    if (!label && id !== undefined) {
      label = `Field ${id}`;
    }
    if (id !== undefined && label !== undefined) {
      fields.push({ id, label, subId });
    }
  }

  return { subsheets, fields };
}

/**
 * Build a downloadable/preview URL for an attachment based on its storage provider.
 * Adjust the routes to match your backend if needed.
 */
export function buildAttachmentUrl(
  a: Pick<SheetAttachmentDTO, "storageProvider" | "storedName" | "storagePath">
): string {
  const provider = a.storageProvider?.toLowerCase?.();

  switch (provider) {
    case "local":
      // Served by your API from local disk using the stored filename
      return `/api/backend/files/${encodeURIComponent(a.storedName)}`;

    case "s3":
      // Served by your API from S3 using the object key (storagePath)
      return `/api/backend/files/s3/${encodeURIComponent(a.storagePath)}`;

    // Add more providers here if you support them:
    // case "azure":
    //   return `/api/backend/files/azure/${encodeURIComponent(a.storagePath)}`;
    // case "gcs":
    //   return `/api/backend/files/gcs/${encodeURIComponent(a.storagePath)}`;

    default:
      // Fall back to a raw path if provided (or empty string)
      return a.storagePath || "";
  }
}

function applySheetInputsForInsert(req: sql.Request, data: UnifiedSheet, userId: number): sql.Request {
  return req
    .input("SheetName",       sql.VarChar(255), nv(data.sheetName))
    .input("SheetDesc",       sql.VarChar(255), nv(data.sheetDesc))
    .input("SheetDesc2",      sql.VarChar(255), nv(data.sheetDesc2))
    .input("ClientDocNum",    sql.Int,          iv(data.clientDocNum))
    .input("ClientProjNum",   sql.Int,          iv(data.clientProjectNum))
    .input("CompanyDocNum",   sql.Int,          iv(data.companyDocNum))
    .input("CompanyProjNum",  sql.Int,          iv(data.companyProjectNum))
    .input("AreaID",          sql.Int,          iv(data.areaId))
    .input("PackageName",     sql.VarChar(100), nv(data.packageName))
    .input("RevisionNum",     sql.Int,          iv(data.revisionNum))
    .input("RevisionDate",    sql.Date,         new Date())
    .input("PreparedByID",    sql.Int,          iv(userId))
    .input("PreparedByDate",  sql.DateTime,     new Date())
    .input("EquipmentName",   sql.VarChar(150), nv(data.equipmentName))
    .input("EquipmentTagNum", sql.VarChar(150), nv(data.equipmentTagNum))
    .input("ServiceName",     sql.VarChar(150), nv(data.serviceName))
    .input("RequiredQty",     sql.Int,          iv(data.requiredQty))
    .input("ItemLocation",    sql.VarChar(255), nv(data.itemLocation))
    .input("ManuID",          sql.Int,          iv(data.manuId))
    .input("SuppID",          sql.Int,          iv(data.suppId))
    .input("InstallPackNum",  sql.VarChar(100), nv(data.installPackNum))
    .input("EquipSize",       sql.Int,          iv(data.equipSize))
    .input("ModelNum",        sql.VarChar(50),  nv(data.modelNum))
    .input("Driver",          sql.VarChar(150), nv(data.driver))
    .input("LocationDwg",     sql.VarChar(255), nv(data.locationDwg))
    .input("PID",             sql.Int,          iv(data.pid))
    .input("InstallDwg",      sql.VarChar(255), nv(data.installDwg))
    .input("CodeStd",         sql.VarChar(255), nv(data.codeStd))
    .input("CategoryID",      sql.Int,          iv(data.categoryId))
    .input("ClientID",        sql.Int,          iv(data.clientId))
    .input("ProjectID",       sql.Int,          iv(data.projectId))
    .input("Status",          sql.VarChar(50),  "Draft")
    .input("IsLatest",        sql.Bit,          1)
    .input("IsTemplate",      sql.Bit,          1)
    .input("AutoCADImport",   sql.Bit,          0);
}

// map core columns for UPDATE (template)
function applySheetInputsForUpdate(req: sql.Request, data: UnifiedSheet, userId: number): sql.Request {
  return req
    .input("SheetName",       sql.VarChar(255), nv(data.sheetName))
    .input("SheetDesc",       sql.VarChar(255), nv(data.sheetDesc))
    .input("SheetDesc2",      sql.VarChar(255), nv(data.sheetDesc2))
    .input("ClientDocNum",    sql.Int,          iv(data.clientDocNum))
    .input("ClientProjNum",   sql.Int,          iv(data.clientProjectNum))
    .input("CompanyDocNum",   sql.Int,          iv(data.companyDocNum))
    .input("CompanyProjNum",  sql.Int,          iv(data.companyProjectNum))
    .input("AreaID",          sql.Int,          iv(data.areaId))
    .input("PackageName",     sql.VarChar(100), nv(data.packageName))
    .input("RevisionNum",     sql.Int,          iv(data.revisionNum))
    .input("RevisionDate",    sql.Date,         new Date())
    .input("EquipmentName",   sql.VarChar(150), nv(data.equipmentName))
    .input("EquipmentTagNum", sql.VarChar(150), nv(data.equipmentTagNum))
    .input("ServiceName",     sql.VarChar(150), nv(data.serviceName))
    .input("RequiredQty",     sql.Int,          iv(data.requiredQty))
    .input("ItemLocation",    sql.VarChar(255), nv(data.itemLocation))
    .input("ManuID",          sql.Int,          iv(data.manuId))
    .input("SuppID",          sql.Int,          iv(data.suppId))
    .input("InstallPackNum",  sql.VarChar(100), nv(data.installPackNum))
    .input("EquipSize",       sql.Int,          iv(data.equipSize))
    .input("ModelNum",        sql.VarChar(50),  nv(data.modelNum))
    .input("Driver",          sql.VarChar(150), nv(data.driver))
    .input("LocationDwg",     sql.VarChar(255), nv(data.locationDwg))
    .input("PID",             sql.Int,          iv(data.pid))
    .input("InstallDwg",      sql.VarChar(255), nv(data.installDwg))
    .input("CodeStd",         sql.VarChar(255), nv(data.codeStd))
    .input("CategoryID",      sql.Int,          iv(data.categoryId))
    .input("ClientID",        sql.Int,          iv(data.clientId))
    .input("ProjectID",       sql.Int,          iv(data.projectId))
    .input("ModifiedByID",    sql.Int,          userId);   // ← use userId
}

/** Insert subsheets + information templates (+ options) for a NEW template. */
async function insertSubsheetTree(tx: sql.Transaction, sheetId: number, data: UnifiedSheet): Promise<void> {
  for (let i = 0; i < data.subsheets.length; i++) {
    const sub = data.subsheets[i];

    const subRs = await tx.request()
      .input("SubName",       sql.VarChar(150), nv(sub.name))
      .input("SheetID",       sql.Int,          sheetId)
      .input("OrderIndex",    sql.Int,          i)
      .input("TemplateSubID", sql.Int,          iv(sub.originalId ?? sub.id))
      .query<{ SubID: number }>(`
        INSERT INTO SubSheets (SubName, SheetID, OrderIndex, TemplateSubID)
        OUTPUT INSERTED.SubID
        VALUES (@SubName, @SheetID, @OrderIndex, @TemplateSubID)
      `);

    const newSubId = subRs.recordset[0].SubID;

    for (let j = 0; j < sub.fields.length; j++) {
      const f = sub.fields[j];

      const infoRs = await tx.request()
        .input("SubID",    sql.Int,          newSubId)
        .input("Label",    sql.VarChar(150), nv(f.label))
        .input("InfoType", sql.VarChar(30),  nv(f.infoType))
        .input("OrderIndex", sql.Int,        f.sortOrder ?? j)
        .input("UOM",      sql.VarChar(50),  nv(f.uom ?? ""))
        .input("Required", sql.Bit,          f.required ? 1 : 0)
        .input("TemplateInfoTemplateID", sql.Int, iv(f.originalId ?? f.id))
        .query<{ InfoTemplateID: number }>(`
          INSERT INTO InformationTemplates
            (SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID)
          OUTPUT INSERTED.InfoTemplateID
          VALUES (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required, @TemplateInfoTemplateID)
        `);

      const newInfoId = infoRs.recordset[0].InfoTemplateID;

      if (Array.isArray(f.options) && f.options.length) {
        for (let k = 0; k < f.options.length; k++) {
          await tx.request()
            .input("InfoTemplateID", sql.Int,          newInfoId)
            .input("OptionValue",    sql.VarChar(100), nv(f.options[k]))
            .input("SortOrder",      sql.Int,          k)
            .query(`
              INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
              VALUES (@InfoTemplateID, @OptionValue, @SortOrder)
            `);
        }
      }
    }
  }
}

/**
 * Full replace of subsheets/tree during UPDATE (optional).
 * If you already have precise diff logic, keep it; this is a safe default.
 */
const SYNC_SUBSHEETS_ON_UPDATE = false;

async function syncSubsheetTree(tx: sql.Transaction, sheetId: number, data: UnifiedSheet): Promise<void> {
  if (!SYNC_SUBSHEETS_ON_UPDATE) return;

  // Remove existing structure
  await tx.request().input("SheetID", sql.Int, sheetId).query(`
    DELETE O FROM InformationTemplateOptions O
    WHERE O.InfoTemplateID IN (
      SELECT IT.InfoTemplateID
      FROM InformationTemplates IT
      JOIN SubSheets SS ON SS.SubID = IT.SubID
      WHERE SS.SheetID = @SheetID
    );

    DELETE IT FROM InformationTemplates IT
    WHERE IT.SubID IN (SELECT SS.SubID FROM SubSheets SS WHERE SS.SheetID = @SheetID);

    DELETE FROM SubSheets WHERE SheetID = @SheetID;
  `);

  // Reinsert from current payload
  await insertSubsheetTree(tx, sheetId, data);
}

/** Reference options (categories, users) for templates page */
export const fetchTemplateReferenceOptions = async () => {
  const pool = await poolPromise;

  const [categories, users] = await Promise.all([
    pool.query(`SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName`),
    pool.query(`SELECT UserID, FirstName, LastName FROM Users ORDER BY FirstName, LastName`)
  ]);

  return {
    categories: categories.recordset,
    users: users.recordset
  };
};

export const fetchAllTemplates = async () => {
  const pool = await poolPromise;

  const result = await pool.query(`
    SELECT 
      s.SheetID AS sheetId,
      s.SheetName AS sheetName,
      s.SheetDesc AS sheetDesc,
      s.CategoryID AS categoryId,
      c.CategoryName AS categoryName,
      s.PreparedByID AS preparedById,
      u.FirstName + ' ' + u.LastName AS preparedByName,
      s.RevisionDate AS revisionDate, 
      s.Status AS status 
    FROM Sheets s
    LEFT JOIN Categories c ON s.CategoryID = c.CategoryID
    LEFT JOIN Users u ON s.PreparedByID = u.UserID
    WHERE s.IsTemplate = 1
    ORDER BY s.SheetID DESC
  `);

  return result.recordset;
};

export const getAllNoteTypes = async (): Promise<NoteType[]> => {
  const pool = await poolPromise;
  const result = await pool.request().query<{
    NoteTypeID: number;
    NoteType: string;
    Description: string | null;
  }>(`
    SELECT NoteTypeID, NoteType, Description
    FROM dbo.NoteTypes
    ORDER BY NoteTypeID
  `);

  return result.recordset.map((r) => ({
    noteTypeId: r.NoteTypeID,
    noteType: r.NoteType,
    description: r.Description,
  }));
};

export async function addSheetNote(args: {
  sheetId: number;
  noteTypeId: number;
  noteText: string;
  createdBy: number | null;
  ensureTemplate?: boolean; // when true, verify IsTemplate = 1
}): Promise<{ noteId: number; orderIndex: number; createdAt: string }> {
  const { sheetId, noteTypeId, noteText, createdBy, ensureTemplate } = args;

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    // 1) Verify sheet exists (and IsTemplate if requested)
    const checkReq = new sql.Request(tx).input("SheetID", sql.Int, sheetId);
    const where = ensureTemplate ? "WHERE SheetID=@SheetID AND IsTemplate=1" : "WHERE SheetID=@SheetID";
    const chk = await checkReq.query<{ SheetID: number }>(`
      SELECT TOP (1) SheetID
      FROM dbo.Sheets
      ${where}
    `);
    if (chk.recordset.length === 0) {
      throw new Error(ensureTemplate ? "Template not found" : "Sheet not found");
    }

    // 2) Compute next OrderIndex within (SheetID, NoteTypeID)
    const idxReq = new sql.Request(tx)
      .input("SheetID", sql.Int, sheetId)
      .input("NoteTypeID", sql.Int, noteTypeId);

    const idxRes = await idxReq.query<{ NextIndex: number }>(`
      SELECT ISNULL(MAX(OrderIndex), 0) + 1 AS NextIndex
      FROM dbo.SheetNotes
      WHERE SheetID = @SheetID AND NoteTypeID = @NoteTypeID
    `);

    const orderIndex = idxRes.recordset[0]?.NextIndex ?? 1;

    // 3) Insert the note
    const insReq = new sql.Request(tx)
      .input("SheetID", sql.Int, sheetId)
      .input("NoteTypeID", sql.Int, noteTypeId)
      .input("NoteText", sql.NVarChar(sql.MAX), noteText)
      .input("OrderIndex", sql.Int, orderIndex)
      .input("CreatedBy", sql.Int, createdBy ?? null);

    const insRes = await insReq.query<{ NoteID: number; CreatedAt: Date }>(`
      INSERT INTO dbo.SheetNotes
        (SheetID, NoteTypeID, NoteText, OrderIndex, CreatedBy, CreatedAt)
      OUTPUT INSERTED.NoteID, INSERTED.CreatedAt
      VALUES
        (@SheetID, @NoteTypeID, @NoteText, @OrderIndex, @CreatedBy, SYSDATETIME())
    `);

    await tx.commit();

    return {
      noteId: insRes.recordset[0].NoteID,
      orderIndex,
      createdAt: insRes.recordset[0].CreatedAt.toISOString(),
    };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function assertSheetExists(sheetId: number, ensureTemplate: boolean, tx: sql.Transaction): Promise<void> {
  const req = new sql.Request(tx).input("SheetID", sql.Int, sheetId);
  const where = ensureTemplate ? "WHERE SheetID=@SheetID AND IsTemplate=1" : "WHERE SheetID=@SheetID";
  const rs = await req.query<{ SheetID: number }>(`SELECT TOP (1) SheetID FROM dbo.Sheets ${where}`);
  if (rs.recordset.length === 0) {
    throw new Error(ensureTemplate ? "Template not found" : "Sheet not found");
  }
}

export async function addSheetAttachment(args: AddSheetAttachmentArgs): Promise<AddSheetAttachmentResult> {
  const { sheetId, file, uploadedBy, ensureTemplate = false } = args;

  // Multer saved file to disk; compute paths and SHA
  const storedName = file.filename; // from diskStorage.filename
  const originalName = file.originalname;
  const contentType = file.mimetype;
  const fileSizeBytes = file.size;
  const storageProvider = "local" as const;

  // Our public path convention
  const storagePath = path.posix.join("attachments", storedName); // saved under public/attachments
  const absPath = path.join(process.cwd(), "public", storagePath);
  const sha256 = await sha256File(absPath);
  const isViewable = isViewableMime(contentType);

  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  await tx.begin();

  try {
    // 0) Safety: sheet exists (and IsTemplate if applicable)
    await assertSheetExists(sheetId, ensureTemplate, tx);

    // 1) Insert into Attachments
    const aReq = new sql.Request(tx)
      .input("OriginalName",   sql.NVarChar(255), originalName)
      .input("StoredName",     sql.NVarChar(255), storedName)
      .input("ContentType",    sql.VarChar(120),  contentType)
      .input("FileSizeBytes",  sql.BigInt,        fileSizeBytes)
      .input("StorageProvider",sql.VarChar(30),   storageProvider)
      .input("StoragePath",    sql.NVarChar(500), storagePath)
      .input("Sha256",         sql.Char(64),      sha256 ?? null)
      .input("UploadedBy",     sql.Int,           uploadedBy)
      .input("IsViewable",     sql.Int,           isViewable ? 1 : 0);

    const aRes = await aReq.query<{ AttachmentID: number; UploadedAt: Date }>(`
      INSERT INTO dbo.Attachments
        (OriginalName, StoredName, ContentType, FileSizeBytes, StorageProvider, StoragePath,
         Sha256, UploadedBy, UploadedAt, Version, IsViewable)
      OUTPUT INSERTED.AttachmentID, INSERTED.UploadedAt
      VALUES
        (@OriginalName, @StoredName, @ContentType, @FileSizeBytes, @StorageProvider, @StoragePath,
         @Sha256, @UploadedBy, SYSDATETIME(), 1, @IsViewable)
    `);

    const attachmentId = aRes.recordset[0].AttachmentID;
    const uploadedAtISO = aRes.recordset[0].UploadedAt.toISOString();

    // 2) Next OrderIndex for this sheet
    const iReq = new sql.Request(tx).input("SheetID", sql.Int, sheetId);
    const iRes = await iReq.query<{ NextIndex: number }>(`
      SELECT ISNULL(MAX(OrderIndex), 0) + 1 AS NextIndex
      FROM dbo.SheetAttachments
      WHERE SheetID = @SheetID
    `);
    const orderIndex = iRes.recordset[0]?.NextIndex ?? 1;

    // 3) Link in SheetAttachments
    const lReq = new sql.Request(tx)
      .input("SheetID",        sql.Int, sheetId)
      .input("AttachmentID",   sql.Int, attachmentId)
      .input("OrderIndex",     sql.Int, orderIndex)
      .input("IsFromTemplate", sql.Bit, 0)
      .input("LinkedFromSheetID", sql.Int, null)
      .input("CloneOnCreate",  sql.Bit, 0);

    const lRes = await lReq.query<{ SheetAttachmentID: number }>(`
      INSERT INTO dbo.SheetAttachments
        (SheetID, AttachmentID, OrderIndex, IsFromTemplate, LinkedFromSheetID, CloneOnCreate, CreatedAt)
      OUTPUT INSERTED.SheetAttachmentID
      VALUES
        (@SheetID, @AttachmentID, @OrderIndex, @IsFromTemplate, @LinkedFromSheetID, @CloneOnCreate, SYSDATETIME())
    `);

    await tx.commit();

    // Build a URL your UI already understands (matches your buildAttachmentUrl for "local")
    const fileUrl = `/api/backend/files/${encodeURIComponent(storedName)}`;

    return {
      attachmentId,
      sheetAttachmentId: lRes.recordset[0].SheetAttachmentID,
      orderIndex,
      originalName,
      storedName,
      contentType,
      fileSizeBytes,
      storageProvider,
      storagePath,          // "attachments/<file>"
      isViewable,
      uploadedAt: uploadedAtISO,
      fileUrl,
    };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function createTemplate(data: UnifiedSheet, userId: number): Promise<number> {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const insertReq = applySheetInputsForInsert(tx.request(), data, userId);
    const sheetRs = await insertReq.query<{ SheetID: number }>(`
      INSERT INTO Sheets (
        SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
        AreaID, PackageName, RevisionNum, RevisionDate, PreparedByID, PreparedByDate,
        EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
        ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver, LocationDwg, PID, InstallDwg, CodeStd,
        CategoryID, ClientID, ProjectID, Status, IsLatest, IsTemplate, AutoCADImport
      )
      OUTPUT INSERTED.SheetID
      VALUES (
        @SheetName, @SheetDesc, @SheetDesc2, @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
        @AreaID, @PackageName, @RevisionNum, @RevisionDate, @PreparedByID, @PreparedByDate,
        @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty, @ItemLocation,
        @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum, @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd,
        @CategoryID, @ClientID, @ProjectID, @Status, @IsLatest, @IsTemplate, @AutoCADImport
      );
    `);

    const sheetId = sheetRs.recordset[0].SheetID;

    // Insert subsheets/templates/options (exactly as before)
    await insertSubsheetTree(tx, sheetId, data);

    await tx.commit();

    // 🔎 Keep your side-effects (outside the TX is typical)
    // If your project logs audits in-transaction, you can move these inside above.
    await insertAuditLog({
      PerformedBy: userId,
      TableName: "Sheets",
      RecordID: sheetId,
      Action: "Create Template",
      Route: undefined,
      Method: "POST",
      StatusCode: 201,
      Changes: JSON.stringify({ ...data, sheetId }),
    });

    await notifyUsers({
      recipientRoleIds: [1, 2], // adjust to your roles
      sheetId,
      title: "New Template Created",
      message: `Template #${sheetId} was created by User #${userId}.`,
      category: "Datasheet",
      createdBy: userId,
    });

    return sheetId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function getTemplateDetailsById(
  templateId: number,
  lang: string = "eng",
  uom: "SI" | "USC" = "SI"
) {
  const pool = await poolPromise;

  // Fetch main sheet details
  const sheetResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`
      SELECT 
        s.SheetID,
        s.SheetName,
        s.SheetDesc,
        s.SheetDesc2,
        s.PackageName,
        s.RevisionNum,
        s.RevisionDate,
        s.PreparedByID,
        u1.FirstName + ' ' + u1.LastName AS preparedByName,
        s.PreparedByDate,
        s.VerifiedByID,
        u2.FirstName + ' ' + u2.LastName AS verifiedByName,
        s.VerifiedByDate,
        s.ApprovedByID,
        u3.FirstName + ' ' + u3.LastName AS approvedByName,
        s.ApprovedByDate,
        s.ClientDocNum,
        s.ClientProjNum,
        s.CompanyDocNum,
        s.CompanyProjNum,
        s.AreaID,
        a.AreaName,
        s.ClientID,
        c.ClientName, 
        c.ClientLogo,
        s.ProjectID,
        p.ProjName AS projectName,
        s.EquipmentName,
        s.EquipmentTagNum,
        s.ServiceName,
        s.EquipSize,
        s.RequiredQty,
        s.ItemLocation,
        s.ManuID,
        m.ManuName AS manuName,
        s.SuppID,
        sup.SuppName AS suppName,
        s.InstallPackNum,
        s.ModelNum,
        s.Driver,
        s.LocationDwg,
        s.PID,
        s.InstallDwg,
        s.CodeStd,
        s.CategoryID,
        cat.CategoryName,
        s.Status,
        s.IsTemplate,
        s.IsLatest,
        s.AutoCADImport,
        s.SourceFilePath,
        s.RejectComment,
        s.ModifiedByID,
        u4.FirstName + ' ' + u4.LastName AS modifiedByName,
        s.ModifiedByDate,
        s.RejectedByID,
        u5.FirstName + ' ' + u5.LastName AS rejectedByName,
        s.RejectedByDate,
        s.TemplateID,
        s.ParentSheetID
      FROM Sheets s
      LEFT JOIN Users u1 ON s.PreparedByID = u1.UserID
      LEFT JOIN Users u2 ON s.VerifiedByID = u2.UserID
      LEFT JOIN Users u3 ON s.ApprovedByID = u3.UserID
      LEFT JOIN Users u4 ON s.ModifiedByID = u4.UserID
      LEFT JOIN Users u5 ON s.RejectedByID = u5.UserID
      LEFT JOIN Areas a ON s.AreaID = a.AreaID
      LEFT JOIN Manufacturers m ON s.ManuID = m.ManuID
      LEFT JOIN Suppliers sup ON s.SuppID = sup.SuppID
      LEFT JOIN Categories cat ON s.CategoryID = cat.CategoryID
      LEFT JOIN Clients c ON s.ClientID = c.ClientID
      LEFT JOIN Projects p ON s.ProjectID = p.ProjectID
      WHERE s.SheetID = @SheetID
    `);

  const row = sheetResult.recordset[0];
  if (!row) return null;

  const datasheet: UnifiedSheet = {
    sheetId: row.SheetID,
    sheetName: row.SheetName,
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    clientId: row.ClientID,
    clientName: row.ClientName,
    clientLogo: row.ClientLogo,
    clientDocNum: row.ClientDocNum,
    clientProjectNum: row.ClientProjNum,
    companyDocNum: row.CompanyDocNum,
    companyProjectNum: row.CompanyProjNum,
    areaId: row.AreaID,
    areaName: row.AreaName,
    packageName: row.PackageName,
    revisionNum: row.RevisionNum,
    revisionDate: row.RevisionDate?.toISOString().split("T")[0] ?? "",
    preparedById: row.PreparedByID,
    preparedByName: row.preparedByName,
    preparedByDate: row.PreparedByDate?.toISOString().split("T")[0] ?? "",
    verifiedById: row.VerifiedByID,
    verifiedByName: row.verifiedByName,
    verifiedDate: row.VerifiedByDate?.toISOString().split("T")[0] ?? "",
    approvedById: row.ApprovedByID,
    approvedByName: row.approvedByName,
    approvedDate: row.ApprovedByDate?.toISOString().split("T")[0] ?? "",
    isLatest: row.IsLatest,
    isTemplate: row.IsTemplate,
    autoCADImport: row.AutoCADImport,
    status: row.Status,
    rejectComment: row.RejectComment,
    rejectedById: row.RejectedByID,
    rejectedByName: row.rejectedByName,
    rejectedByDate: row.RejectedByDate?.toISOString().split("T")[0] ?? "",
    modifiedById: row.ModifiedByID,
    modifiedByName: row.modifiedByName,
    modifiedByDate: row.ModifiedByDate?.toISOString().split("T")[0] ?? "",
    itemLocation: row.ItemLocation,
    requiredQty: row.RequiredQty,
    equipmentName: row.EquipmentName,
    equipmentTagNum: row.EquipmentTagNum,
    serviceName: row.ServiceName,
    manuId: row.ManuID,
    manuName: row.manuName,
    suppId: row.SuppID,
    suppName: row.suppName,
    installPackNum: row.InstallPackNum,
    equipSize: row.EquipSize,
    modelNum: row.ModelNum,
    driver: row.Driver,
    locationDwg: row.LocationDwg,
    categoryId: row.CategoryID,
    categoryName: row.CategoryName,
    projectId: row.ProjectID,
    projectName: row.projectName,
    pid: row.PID,
    installDwg: row.InstallDwg,
    codeStd: row.CodeStd,
    templateId: row.TemplateID,
    parentSheetId: row.ParentSheetID,
    sourceFilePath: row.SourceFilePath,
    subsheets: [],
  };

  // Fetch subsheets and info fields
  const subsheetResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query(`SELECT SubID, SubName, OrderIndex FROM SubSheets WHERE SheetID = @SheetID ORDER BY OrderIndex`);

  const subsheets: UnifiedSubsheet[] = [];

  for (const sub of subsheetResult.recordset) {
    const templateResult = await pool.request()
      .input("SubID", sql.Int, sub.SubID)
      .query(`
        SELECT InfoTemplateID, Label, InfoType, UOM, Required, OrderIndex
        FROM InformationTemplates
        WHERE SubID = @SubID
        ORDER BY OrderIndex
      `);

    const fields: InfoField[] = await Promise.all(
      templateResult.recordset.map(async (t) => {
        const optionResult = await pool.request()
          .input("InfoTemplateID", sql.Int, t.InfoTemplateID)
          .query(`SELECT OptionValue FROM InformationTemplateOptions WHERE InfoTemplateID = @InfoTemplateID ORDER BY SortOrder`);

        let displayUOM = t.UOM;
        if (uom === "USC" && t.UOM) {
          const result = convertToUSC("1", t.UOM);
          if (result) displayUOM = result.unit;
        }

        return {
          id: t.InfoTemplateID,
          label: t.Label,
          infoType: t.InfoType as "int" | "decimal" | "varchar",
          uom: displayUOM,
          sortOrder: t.OrderIndex ?? 1,
          required: t.Required === true || t.Required === 1,
          options: optionResult.recordset.map((o) => o.OptionValue),
        };
      })
    );

    subsheets.push({
      id: sub.SubID,
      name: sub.SubName,
      fields,
    });
  }

  datasheet.subsheets = subsheets;

  // ─────────────────────────────────────────────────────────────
  // NOTES for templates (join NoteTypes to get display name)
  // ─────────────────────────────────────────────────────────────
  type NoteRow = {
    id: number;
    noteTypeId: number | null;
    noteTypeName: string | null;
    orderIndex: number | null;
    body: string | null;
    createdAt: Date | string | null;
    createdBy: number | null;
    createdByName: string | null;
  };

  const notesResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query<NoteRow>(`
      SELECT
        n.NoteID       AS id,
        n.NoteTypeID   AS noteTypeId,
        nt.NoteType    AS noteTypeName,
        n.OrderIndex   AS orderIndex,
        n.NoteText     AS body,
        n.CreatedAt    AS createdAt,
        n.CreatedBy    AS createdBy,
        u.FirstName + ' ' + u.LastName AS createdByName
      FROM dbo.SheetNotes n
      LEFT JOIN dbo.NoteTypes nt ON nt.NoteTypeID = n.NoteTypeID
      LEFT JOIN dbo.Users u ON u.UserID = n.CreatedBy
      WHERE n.SheetID = @SheetID
      ORDER BY n.OrderIndex ASC, n.CreatedAt DESC
    `);

  const notes: SheetNoteDTO[] = notesResult.recordset.map<SheetNoteDTO>((r) => ({
    id: r.id,
    noteTypeId: r.noteTypeId,
    noteTypeName: r.noteTypeName ?? null,
    orderIndex: r.orderIndex,
    body: r.body ?? "",
    createdAt: r.createdAt ? new Date(r.createdAt as unknown as string).toISOString() : "",
    createdBy: r.createdBy,
    createdByName: r.createdByName ?? null,
  }));

  (datasheet as typeof datasheet & { notes: SheetNoteDTO[] }).notes = notes;

  // ─────────────────────────────────────────────────────────────
  // ATTACHMENTS for templates (SheetAttachments → Attachments)
  // ─────────────────────────────────────────────────────────────
  type AttachmentRow = {
    sheetAttachmentId: number;
    orderIndex: number | null;
    isFromTemplate: boolean | number | null;
    linkedFromSheetId: number | null;
    cloneOnCreate: boolean | number | null;

    id: number;
    originalName: string | null;
    storedName: string | null;
    contentType: string | null;
    fileSizeBytes: number | null;
    storageProvider: string | null;
    storagePath: string | null;
    sha256: string | null;
    uploadedBy: number | null;
    uploadedAt: Date | string | null;
    isViewable: boolean | number | null;
    uploadedByName: string | null;
  };

  const attsResult = await pool.request()
    .input("SheetID", sql.Int, templateId)
    .query<AttachmentRow>(`
      SELECT
        sa.SheetAttachmentID           AS sheetAttachmentId,
        sa.OrderIndex                  AS orderIndex,
        sa.IsFromTemplate              AS isFromTemplate,
        sa.LinkedFromSheetID           AS linkedFromSheetId,
        sa.CloneOnCreate               AS cloneOnCreate,
        sa.CreatedAt                   AS linkedCreatedAt,

        a.AttachmentID                 AS id,
        a.OriginalName                 AS originalName,
        a.StoredName                   AS storedName,
        a.ContentType                  AS contentType,
        a.FileSizeBytes                AS fileSizeBytes,
        a.StorageProvider              AS storageProvider,
        a.StoragePath                  AS storagePath,
        a.Sha256                       AS sha256,
        a.UploadedBy                   AS uploadedBy,
        a.UploadedAt                   AS uploadedAt,
        a.IsViewable                   AS isViewable,
        u.FirstName + ' ' + u.LastName AS uploadedByName
      FROM dbo.SheetAttachments sa
      INNER JOIN dbo.Attachments a
        ON a.AttachmentID = sa.AttachmentID
      LEFT JOIN dbo.Users u
        ON u.UserID = a.UploadedBy
      WHERE sa.SheetID = @SheetID
      ORDER BY sa.OrderIndex ASC, a.UploadedAt DESC
    `);

  const attachments: SheetAttachmentDTO[] = attsResult.recordset.map<SheetAttachmentDTO>((r) => {
    const dto: SheetAttachmentDTO = {
      sheetAttachmentId: r.sheetAttachmentId,
      orderIndex: Number(r.orderIndex ?? 0),
      isFromTemplate: typeof r.isFromTemplate === "boolean" ? r.isFromTemplate : r.isFromTemplate === 1,
      linkedFromSheetId: r.linkedFromSheetId ?? null,
      cloneOnCreate: typeof r.cloneOnCreate === "boolean" ? r.cloneOnCreate : r.cloneOnCreate === 1,

      id: r.id,
      originalName: r.originalName ?? "",
      storedName: r.storedName ?? "",
      contentType: r.contentType ?? "",
      fileSizeBytes: Number(r.fileSizeBytes ?? 0),
      storageProvider: r.storageProvider ?? "",
      storagePath: r.storagePath ?? "",
      sha256: r.sha256 ?? null,
      uploadedBy: r.uploadedBy ?? null,
      uploadedByName: r.uploadedByName ?? null,
      uploadedAt: r.uploadedAt ? new Date(r.uploadedAt as unknown as string).toISOString() : "",
      isViewable: typeof r.isViewable === "boolean" ? r.isViewable : r.isViewable === 1,
      fileUrl: "",
    };
    dto.fileUrl = buildAttachmentUrl(dto);
    return dto;
  });

  (datasheet as typeof datasheet & { attachments: SheetAttachmentDTO[] }).attachments = attachments;

  // Fetch translations
  const translations = await getSheetTranslations(templateId, lang);

  // Apply translation and preserve notes/attachments on the returned object
  const translatedSheet = applySheetTranslations(datasheet, translations) as typeof datasheet & {
    notes: SheetNoteDTO[];
    attachments: SheetAttachmentDTO[];
  };
  translatedSheet.notes = (datasheet as typeof translatedSheet).notes;
  translatedSheet.attachments = (datasheet as typeof translatedSheet).attachments;

  return { datasheet: translatedSheet, translations };
}


export async function updateTemplate(sheetId: number, data: UnifiedSheet, userId: number): Promise<number> {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const updateReq = applySheetInputsForUpdate(tx.request(), data, userId)
      .input("SheetID", sql.Int, sheetId);

    await updateReq.query(`
      UPDATE Sheets
      SET SheetName = @SheetName, SheetDesc = @SheetDesc, SheetDesc2 = @SheetDesc2,
          ClientDocNum = @ClientDocNum, ClientProjNum = @ClientProjNum,
          CompanyDocNum = @CompanyDocNum, CompanyProjNum = @CompanyProjNum,
          AreaID = @AreaID, PackageName = @PackageName,
          RevisionNum = @RevisionNum, RevisionDate = @RevisionDate,
          EquipmentName = @EquipmentName, EquipmentTagNum = @EquipmentTagNum,
          ServiceName = @ServiceName, RequiredQty = @RequiredQty, ItemLocation = @ItemLocation,
          ManuID = @ManuID, SuppID = @SuppID, InstallPackNum = @InstallPackNum,
          EquipSize = @EquipSize, ModelNum = @ModelNum, Driver = @Driver, LocationDwg = @LocationDwg,
          PID = @PID, InstallDwg = @InstallDwg, CodeStd = @CodeStd,
          CategoryID = @CategoryID, ClientID = @ClientID, ProjectID = @ProjectID,
          ModifiedByID = @ModifiedByID, ModifiedDate = SYSDATETIME()
      WHERE SheetID = @SheetID AND IsTemplate = 1
    `);

    // If you also update subsheets/templates/options during update, flip the flag:
    await syncSubsheetTree(tx, sheetId, data);

    await tx.commit();

    await insertAuditLog({
      PerformedBy: userId,
      TableName: "Sheets",
      RecordID: sheetId,
      Action: "Update Template",
      Route: undefined,
      Method: "PUT",
      StatusCode: 200,
      Changes: JSON.stringify({ ...data, sheetId }),
    });

    await notifyUsers({
      recipientRoleIds: [1, 2],
      sheetId,
      title: "Template Updated",
      message: `Template #${sheetId} was updated by User #${userId}.`,
      category: "Datasheet",
      createdBy: userId,
    });

    return sheetId;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function verifyTemplate(
  sheetId: number,
  action: "verify" | "reject",
  rejectionComment: string | undefined,
  verifiedById: number
) {
  const pool = await poolPromise;
  const status = action === "verify" ? "Verified" : "Rejected";

  // 🔹 1. Get verifier's first name
  const userResult = await pool
    .request()
    .input("UserID", sql.Int, verifiedById)
    .query(`SELECT FirstName FROM Users WHERE UserID = @UserID`);

  const verifiedByName = userResult.recordset[0]?.FirstName || `User #${verifiedById}`;

  // 🔹 2. Build and execute update query for Sheets
  const request = pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("Status", sql.VarChar, status);

  if (action === "verify") {
    request
      .input("VerifiedByID", sql.Int, verifiedById)
      .input("VerifiedByDate", sql.DateTime, new Date());

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        VerifiedByID = @VerifiedByID,
        VerifiedByDate = @VerifiedByDate
      WHERE SheetID = @SheetID
    `);
  } else if (action === "reject") {
    request
      .input("RejectedByID", sql.Int, verifiedById)
      .input("RejectedByDate", sql.DateTime, new Date())
      .input("RejectComment", sql.NVarChar, rejectionComment || null);

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        RejectedByID = @RejectedByID,
        RejectedByDate = @RejectedByDate,
        RejectComment = @RejectComment
      WHERE SheetID = @SheetID
    `);
  }

  // 🔹 3. Audit log
  await insertAuditLog({
    PerformedBy: verifiedById,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: action === "verify" ? "Verify Template" : "Reject Template",
  });

  // 🔹 4. Notify Admins (RoleID 1)
  await notifyUsers({
    recipientRoleIds: [1], // Admins
    sheetId,
    title: `Template ${status}`,
    message: `Template #${sheetId} has been ${status.toLowerCase()} by ${verifiedByName}.`,
    category: "Template",
    createdBy: verifiedById,
  });

  // 🔹 5. Notify the Engineer (PreparedByID)
  const preparedByResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID
    `);

  const preparedById = preparedByResult.recordset[0]?.PreparedByID;

  if (preparedById) {
    await notifyUsers({
      recipientUserIds: [preparedById],
      sheetId,
      title: `Your template was ${status.toLowerCase()}`,
      message: `Your template #${sheetId} has been ${status.toLowerCase()} by ${verifiedByName}.`,
      category: "Template",
      createdBy: verifiedById,
    });
  }
}

export async function approveTemplate(sheetId: number, approvedById: number): Promise<number> {
  const pool = await poolPromise;

  // 🔹 Update the sheet
  const updateResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("ApprovedByID", sql.Int, approvedById)
    .input("ApprovedByDate", sql.DateTime, new Date())
    .input("Status", sql.VarChar(50), "Approved")
    .query(`
      UPDATE Sheets
      SET Status = @Status,
          ApprovedByID = @ApprovedByID,
          ApprovedByDate = @ApprovedByDate
      WHERE SheetID = @SheetID
    `);

  // 🔍 Check if any rows were updated
  if (updateResult.rowsAffected[0] === 0) {
    console.warn(`⚠️ No sheet found or updated for SheetID: ${sheetId}`);
    throw new Error("Sheet not found or already updated.");
  }

  // ✅ Insert audit log
  await insertAuditLog({
    PerformedBy: approvedById,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: "Approve Template",
  });

  // 🔍 Fetch who created the sheet
  const creatorResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query("SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID");

  const preparedById = creatorResult.recordset[0]?.PreparedByID;

  if (preparedById) {
    try {
      await notifyUsers({
        recipientUserIds: [preparedById],
        sheetId,
        createdBy: approvedById,
        category: "Template",
        title: "Template Approved",
        message: `Your template #${sheetId} has been approved.`,
      });
    } catch (err) {
      console.error("❌ Failed to send notification:", err);
    }
  } else {
    console.warn(`⚠️ No PreparedByID found for SheetID: ${sheetId}`);
  }

  return sheetId;
}

// ──────────────────────────────────────────────────────────────
// Controller compatibility helpers (additive; do not remove existing code)
// ──────────────────────────────────────────────────────────────

/** List notes for a template sheet (non-destructive). */
export async function listTemplateNotes(sheetId: number): Promise<SheetNoteDTO[]> {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT NoteID, SheetID, Text, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
      FROM SheetNotes
      WHERE SheetID = @SheetID
      ORDER BY CreatedAt DESC, NoteID DESC
    `);
  return rs.recordset ?? [];
}

/** Update a single note’s text for a template sheet. */
export async function updateTemplateNote(
  sheetId: number,
  noteId: number,
  payload: NoteUpdatePayload,
  userId: number
): Promise<void> {
  if (typeof payload.text !== "string" || !payload.text.trim()) {
    throw new Error("Note text is required");
  }
  const pool = await poolPromise;
  await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("NoteID", sql.Int, noteId)
    .input("Text", sql.NVarChar, payload.text)
    .input("UpdatedBy", sql.Int, userId)
    .query(`
      UPDATE SheetNotes
      SET Text = @Text, UpdatedBy = @UpdatedBy, UpdatedAt = SYSDATETIME()
      WHERE NoteID = @NoteID AND SheetID = @SheetID
    `);
}

/** Delete a single note from a template sheet. */
export async function deleteTemplateNote(sheetId: number, noteId: number): Promise<void> {
  const pool = await poolPromise;
  await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("NoteID", sql.Int, noteId)
    .query(`
      DELETE FROM SheetNotes
      WHERE NoteID = @NoteID AND SheetID = @SheetID
    `);
}

/** List attachments for a template sheet. */
export async function listTemplateAttachments(sheetId: number): Promise<SheetAttachmentDTO[]> {
  const pool = await poolPromise;
  const rs = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT AttachmentID, SheetID, FileName, FileUrl, MimeType, Size, UploadedBy, UploadedAt
      FROM Attachments
      WHERE SheetID = @SheetID
      ORDER BY UploadedAt DESC, AttachmentID DESC
    `);
  return rs.recordset ?? [];
}

/** Delete a single attachment from a template sheet. */
export async function deleteTemplateAttachment(sheetId: number, attachmentId: number): Promise<void> {
  const pool = await poolPromise;
  await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("AttachmentID", sql.Int, attachmentId)
    .query(`
      DELETE FROM Attachments
      WHERE AttachmentID = @AttachmentID AND SheetID = @SheetID
    `);
}

// Normalize createTemplate's return into a { sheetId } shape
function toSheetId(result: unknown): number {
  if (typeof result === "number") return result;

  if (
    result !== null &&
    typeof result === "object" &&
    "sheetId" in result
  ) {
    const id = (result as { sheetId: unknown }).sheetId;
    if (typeof id === "number") return id;
  }

  throw new Error("createTemplate returned an unexpected type");
}

/**
 * Clone a template into a NEW template (keeps your long service intact).
 * - Reads source with getTemplateDetailsById
 * - Applies overrides
 * - Calls your existing createTemplate
 * - Normalizes the return to { sheetId }
 */
export async function cloneTemplateFrom(
  sourceTemplateId: number,
  overrides: Partial<UnifiedSheet>,
  userId: number
): Promise<{ sheetId: number }> {
  const details = await getTemplateDetailsById(sourceTemplateId);
  if (!details?.datasheet) {
    throw new Error("Source template not found");
  }
  const src = details.datasheet;

  const payload: UnifiedSheet = {
    ...src,
    ...overrides,
    sheetId: undefined,
    isTemplate: true,
    status: "Draft",
    preparedById: userId,
    preparedByDate: new Date().toISOString(),
    verifiedById: null,
    verifiedDate: null,
    approvedById: null,
    approvedDate: null,
  };

  const created = await createTemplate(payload, userId) as unknown;
  const newId = toSheetId(created);
  return { sheetId: newId };
}

export async function exportTemplatePDF(
  templateId: number,
  lang: string = "eng",
  uom: UOM = "SI"
): Promise<string> {
  const dir = path.resolve(process.cwd(), "public", "exports");
  await fs.mkdir(dir, { recursive: true });

  const outPath = path.join(dir, `template_${templateId}.pdf`);

  const templateDetails = await getTemplateDetailsById(templateId, lang, uom);
  if (!templateDetails) throw new Error(`Template ${templateId} not found`);

  const datasheetLike: UnifiedSheet = hasDatasheet(templateDetails)
    ? templateDetails.datasheet
    : toDatasheetLikeFromTemplate(templateDetails);

  // Your generator takes (datasheet, lang, uom)
  const result = await generateDatasheetPDF(datasheetLike, lang, uom);
  return normalizeToPath(result, outPath);
}

export async function exportTemplateExcel(
  templateId: number,
  lang: string = "eng",
  uom: UOM = "SI"
): Promise<string> {
  const dir = path.resolve(process.cwd(), "public", "exports");
  await fs.mkdir(dir, { recursive: true });

  const outPath = path.join(dir, `template_${templateId}.xlsx`);

  const templateDetails = await getTemplateDetailsById(templateId, lang, uom);
  if (!templateDetails) throw new Error(`Template ${templateId} not found`);

  const datasheetLike: UnifiedSheet = hasDatasheet(templateDetails)
    ? templateDetails.datasheet
    : toDatasheetLikeFromTemplate(templateDetails);

  const result = await generateDatasheetExcel(datasheetLike, lang, uom);
  return normalizeToPath(result, outPath);
}

export async function doesTemplateEquipmentTagExist(
  tag: string,
  projectId: number
): Promise<boolean> {
  const pool = await poolPromise
  const req = pool.request()

  req.input("ProjectID", sql.Int, projectId)
  req.input("Tag", sql.NVarChar, tag)

  const rs = await req.query<{ Exists: number }>(`
    SELECT TOP 1 1 AS Exists
    FROM Sheets
    WHERE IsTemplate = 1
      AND ProjectID = @ProjectID
      AND EquipmentTagNum = @Tag
  `)

  const recordCount = rs.recordset?.length ?? 0
  const hasExistingTag = recordCount > 0
  return hasExistingTag
}
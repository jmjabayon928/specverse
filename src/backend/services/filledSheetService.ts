// src/backend/services/filledSheetService.ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { poolPromise, sql } from "../config/db";
import { insertAuditLog } from "../database/auditQueries";
import { notifyUsers } from "../utils/notifyUsers";
import type { 
  InfoField,
  SheetStatus, 
  UnifiedSheet, 
  UnifiedSubsheet,
  AttachmentMeta,
  NoteCreatePayload,
  NoteUpdatePayload,
} from "@/domain/datasheets/sheetTypes";
import type { AuditContext } from "@/domain/audit/auditTypes";
import { convertToUSC } from "@/utils/unitConversionTable";
import { getSheetTranslations } from "@/backend/services/translationService";
import { applySheetTranslations } from "@/utils/applySheetTranslations";
import { generateDatasheetPDF } from "@/utils/generateDatasheetPDF";
import { generateDatasheetExcel } from "@/utils/generateDatasheetExcel";

type UOM = "SI" | "USC";

async function ensureDir(dir: string): Promise<void> {
  try { await fs.mkdir(dir, { recursive: true }); } catch { /* noop */ }
}
async function exists(p: string): Promise<boolean> {
  try { await fs.stat(p); return true; } catch { return false; }
}

/** Accept Buffer | {buffer: Buffer} | string | void and ensure outPath exists. */
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
    throw new Error(`Export generator did not create file: ${outPath}`);
  }
  return outPath;
}

export type NoteType = {
  noteTypeId: number;
  noteType: string;
  description: string | null;
};

export type SheetNoteDTO = {
  id: number;
  noteTypeId: number | null;
  noteTypeName?: string | null;   // ← add this
  orderIndex: number | null;
  body: string;
  createdAt: string;
  createdBy?: number | null;
  createdByName?: string | null;
};

export type CreateFilledNoteInput = {
  sheetId: number;
  noteTypeId: number;
  body: string;
  createdBy?: number | null;
};

export type SheetAttachmentDTO = {
  // link table props
  sheetAttachmentId: number;
  orderIndex: number;
  isFromTemplate: boolean;
  linkedFromSheetId?: number | null;
  cloneOnCreate: boolean;

  // file props
  id: number;
  originalName: string;
  storedName: string;
  contentType: string;
  fileSizeBytes: number;
  storageProvider: string;
  storagePath: string;
  sha256?: string | null;
  uploadedBy?: number | null;
  uploadedByName?: string | null;
  uploadedAt: string;             // ISO
  isViewable: boolean;
  fileUrl?: string;
};

// Build a URL for an attachment (adapt to your backend routes/providers)
function buildAttachmentUrl(
  a: Pick<SheetAttachmentDTO, "storageProvider" | "storedName" | "storagePath">
): string {
  switch (a.storageProvider?.toLowerCase?.()) {
    case "local":
      return `/api/backend/files/${encodeURIComponent(a.storedName)}`;
    case "s3":
      return `/api/backend/files/s3/${encodeURIComponent(a.storagePath)}`;
    default:
      return a.storagePath || "";
  }
}

export type CreatedAttachmentDTO = {
  attachmentId: number;
  sheetAttachmentId: number;
  orderIndex: number;
  originalName: string;
  storedName: string;
  contentType: string;
  fileSizeBytes: number;
  storageProvider: string;
  storagePath: string;
  sha256: string | null;
  uploadedBy: number | null;
  uploadedAt: string;   // ISO
  fileUrl: string;      // convenient for UI (same as storagePath for 'public')
};

export type CreateAttachmentInput = {
  sheetId: number;
  originalName: string;
  storedName: string;
  contentType: string;
  fileSizeBytes: number;
  storageProvider: string; // "public" | "local" | "s3" | ...
  storagePath: string;     // e.g. "/attachments/abc.png" for 'public'
  sha256?: string | null;
  uploadedBy?: number | null;
};

export type RequiredTemplateField = {
  infoTemplateId: number;
  required: boolean;
  infoType: string; 
  label: string | null;
};
// === END types & helper ===

export const fetchAllFilled = async () => {
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
    WHERE s.IsTemplate = 0
    ORDER BY s.SheetID DESC
  `);

  return result.recordset;
};

export async function getRequiredTemplateFields(templateId: number): Promise<RequiredTemplateField[]> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("TemplateID", sql.Int, templateId);

  const rs = await req.query<{
    InfoTemplateID: number;
    Required: boolean | number;
    InfoType: string | null;
    Label: string | null;
  }>(`
    SELECT t.InfoTemplateID, t.Required, t.InfoType, t.Label
    FROM dbo.SubSheets s
    JOIN dbo.InformationTemplates t ON t.SubID = s.SubID
    WHERE s.SheetID = @TemplateID
    ORDER BY s.OrderIndex, t.OrderIndex;
  `);

  return rs.recordset.map((r) => ({
    infoTemplateId: r.InfoTemplateID,
    required: r.Required === true || r.Required === 1,
    infoType: r.InfoType ?? "varchar",   // ← no 'as any'
    label: r.Label ?? null,
  }));
}

export async function createFilledSheet(
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  context: AuditContext
): Promise<{ sheetId: number }> {
  return runInTransaction(async (tx) => {
    // 0) Validation
    const templateIdNum = validateTopLevel(data);

    // 0b) Pull template fields
    const templateRows = await fetchTemplateFields(tx, templateIdNum);

    // 0c) Check required template values
    const fieldMap = buildTemplateFieldMap(templateRows);
    validateRequiredTemplateValues(fieldMap, data.fieldValues);

    // 1) Insert parent Sheet
    const sheetId = await insertSheet(tx, data, context.userId, templateIdNum);

    // 2) Clone subsheets + templates + options + values
    await cloneSubsheetsAndFields(tx, sheetId, data, fieldMap);

    // 3) Audit + notify
    await writeAuditAndNotify(sheetId, data, context);

    return { sheetId };
  });
}

/* ───────────────── helpers: tx, guards, coercers ────────────── */

async function runInTransaction<T>(fn: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const pool = await poolPromise;
  const tx = new sql.Transaction(pool);
  try {
    await tx.begin();
    const out = await fn(tx);
    await tx.commit();
    return out;
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

// NVARCHAR/VARCHAR normalizer: return null for blanks
function nv(v: unknown): string | null {
  return isBlank(v) ? null : String(v);
}

// INT normalizer: null for blanks; number if finite
function iv(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ────────────── helpers: validation / template meta ─────────── */

function validateTopLevel(data: UnifiedSheet): number {
  const errs: string[] = [];
  const must = (val: unknown, label: string) => { if (isBlank(val)) errs.push(`Missing required field: ${label}`); };

  must(data.sheetName, "Sheet Name");
  must(data.equipmentName, "Equipment Name");
  must(data.equipmentTagNum, "Equipment Tag Number");
  must(data.categoryId, "Category");
  must(data.clientId, "Client");
  must(data.projectId, "Project");

  const t = Number(data.templateId);
  if (!Number.isInteger(t) || t <= 0) errs.push("Invalid templateId.");

  if (errs.length) throw new Error(`VALIDATION: ${errs.join("; ")}`);
  return t;
}

async function fetchTemplateFields(
  tx: sql.Transaction,
  templateId: number
) {
  const rs = await tx.request()
    .input("TemplateID", sql.Int, templateId)
    .query(`
      SELECT t.InfoTemplateID, t.Required, t.UOM, t.OrderIndex, s.SubName, t.Label
      FROM InformationTemplates t
      JOIN Subsheets s ON t.SubID = s.SubID
      WHERE s.SheetID = @TemplateID
      ORDER BY s.OrderIndex, t.OrderIndex
    `);

  return rs.recordset ?? [];
}

function buildTemplateFieldMap(
  rows: Array<{
    InfoTemplateID: number;
    Required: boolean | number;
    UOM: string | null;
    OrderIndex: number;
    SubName: string;
    Label?: string | null;
  }>
): Record<string, Record<number, { required: boolean; uom: string | null; label?: string | null }>> {
  const map: Record<string, Record<number, { required: boolean; uom: string | null; label?: string | null }>> = {};
  for (const r of rows) {
    if (!map[r.SubName]) map[r.SubName] = {};
    map[r.SubName][r.OrderIndex] = {
      required: r.Required === true || r.Required === 1,
      uom: r.UOM,
      label: r.Label ?? null,
    };
  }
  return map;
}

function validateRequiredTemplateValues(
  fieldMap: Record<string, Record<number, { required: boolean; uom: string | null; label?: string | null }>>,
  values: Record<string, string>
): void {
  const missing: string[] = [];
  for (const [subName, entries] of Object.entries(fieldMap)) {
    for (const [orderStr, meta] of Object.entries(entries)) {
      if (!meta.required) continue;
      const order = Number(orderStr);
      const raw = values?.[String(getOriginalInfoTemplateIdKey(subName, order))] ?? values?.[orderStr]; // support either keying style
      if (isBlank(raw)) {
        const label = meta.label || `${subName} / Field #${order}`;
        missing.push(label);
      }
    }
  }
  if (missing.length) {
    throw new Error(`VALIDATION: Missing required values for: ${missing.join(", ")}`);
  }
}

// If you key fieldValues by original InfoTemplateID directly, you can keep a passthrough.
// This stub exists to keep the logic isolated if you later change the keying.
function getOriginalInfoTemplateIdKey(_subName: string, orderIndex: number): number {
  return orderIndex;
}

/* ────────────── helpers: insert sheet + children ────────────── */

async function insertSheet(
  tx: sql.Transaction,
  data: UnifiedSheet,
  userId: number | undefined,
  templateIdNum: number
): Promise<number> {
  const rs = await tx.request()
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
    .input("IsTemplate",      sql.Bit,          0)
    .input("AutoCADImport",   sql.Bit,          0)
    .input("TemplateID",      sql.Int,          templateIdNum)
    .query<{ SheetID: number }>(`
      INSERT INTO Sheets (
        SheetName, SheetDesc, SheetDesc2, ClientDocNum, ClientProjNum, CompanyDocNum, CompanyProjNum,
        AreaID, PackageName, RevisionNum, RevisionDate, PreparedByID, PreparedByDate,
        EquipmentName, EquipmentTagNum, ServiceName, RequiredQty, ItemLocation,
        ManuID, SuppID, InstallPackNum, EquipSize, ModelNum, Driver, LocationDwg, PID, InstallDwg, CodeStd,
        CategoryID, ClientID, ProjectID, Status, IsLatest, IsTemplate, AutoCADImport, TemplateID
      )
      OUTPUT INSERTED.SheetID
      VALUES (
        @SheetName, @SheetDesc, @SheetDesc2, @ClientDocNum, @ClientProjNum, @CompanyDocNum, @CompanyProjNum,
        @AreaID, @PackageName, @RevisionNum, @RevisionDate, @PreparedByID, @PreparedByDate,
        @EquipmentName, @EquipmentTagNum, @ServiceName, @RequiredQty, @ItemLocation,
        @ManuID, @SuppID, @InstallPackNum, @EquipSize, @ModelNum, @Driver, @LocationDwg, @PID, @InstallDwg, @CodeStd,
        @CategoryID, @ClientID, @ProjectID, @Status, @IsLatest, @IsTemplate, @AutoCADImport, @TemplateID
      );
    `);

  return rs.recordset[0].SheetID;
}

async function cloneSubsheetsAndFields(
  tx: sql.Transaction,
  sheetId: number,
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  fieldMap: Record<string, Record<number, { required: boolean; uom: string | null; label?: string | null }>>
): Promise<void> {
  for (let i = 0; i < data.subsheets.length; i++) {
    const subsheet = data.subsheets[i];
    const newSubId = await insertSubsheet(tx, sheetId, subsheet.name, subsheet.id, i);

    for (let j = 0; j < subsheet.fields.length; j++) {
  const field = subsheet.fields[j];
  const meta = fieldMap[subsheet.name]?.[field.sortOrder ?? j];

  // apply template overrides into a new object
  const enrichedField: InfoField = {
    ...field,
    uom: meta?.uom ?? field.uom,
    required: meta?.required ?? Boolean(field.required),
  };

  const newInfoId = await insertInfoTemplate(
    tx,
    newSubId,
    enrichedField,
    enrichedField.sortOrder ?? j
  );

  if (Array.isArray(enrichedField.options) && enrichedField.options.length) {
    await insertInfoOptions(tx, newInfoId, enrichedField.options);
  }

  const originalId = enrichedField.id ?? undefined;
  if (originalId !== undefined) {
    const raw = data.fieldValues[String(originalId)];
    if (!isBlank(raw)) {
      await insertInfoValue(tx, newInfoId, sheetId, String(raw));
    }
  }
}
  }
}

async function insertSubsheet(
  tx: sql.Transaction,
  sheetId: number,
  subName: string,
  templateSubId: number | undefined,
  orderIndex: number
): Promise<number> {
  const rs = await tx.request()
    .input("SubName",        sql.VarChar(150), nv(subName))
    .input("SheetID",        sql.Int,          sheetId)
    .input("OrderIndex",     sql.Int,          orderIndex)
    .input("TemplateSubID",  sql.Int,          iv(templateSubId))
    .query<{ SubID: number }>(`
      INSERT INTO SubSheets (SubName, SheetID, OrderIndex, TemplateSubID)
      OUTPUT INSERTED.SubID
      VALUES (@SubName, @SheetID, @OrderIndex, @TemplateSubID);
    `);
  return rs.recordset[0].SubID;
}

async function insertInfoTemplate(
  tx: sql.Transaction,
  subId: number,
  field: InfoField,
  orderIndex: number
): Promise<number> {
  const required = Boolean(field.required);
  const uom = field.uom ?? "";

  const rs = await tx.request()
    .input("SubID",                  sql.Int,          subId)
    .input("Label",                  sql.VarChar(150), nv(field.label))
    .input("InfoType",               sql.VarChar(30),  nv(field.infoType))
    .input("OrderIndex",             sql.Int,          orderIndex)
    .input("UOM",                    sql.VarChar(50),  nv(uom))
    .input("Required",               sql.Bit,          required ? 1 : 0)
    .input("TemplateInfoTemplateID", sql.Int,          iv(field.id)) // original template field id
    .query<{ InfoTemplateID: number }>(`
      INSERT INTO InformationTemplates
        (SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID)
      OUTPUT INSERTED.InfoTemplateID
      VALUES
        (@SubID, @Label, @InfoType, @OrderIndex, @UOM, @Required, @TemplateInfoTemplateID);
    `);

  return rs.recordset[0].InfoTemplateID;
}

async function insertInfoOptions(
  tx: sql.Transaction,
  infoTemplateId: number,
  options: string[]
): Promise<void> {
  for (let k = 0; k < options.length; k++) {
    await tx.request()
      .input("InfoTemplateID", sql.Int,          infoTemplateId)
      .input("OptionValue",    sql.VarChar(100), nv(options[k]))
      .input("SortOrder",      sql.Int,          k)
      .query(`
        INSERT INTO InformationTemplateOptions (InfoTemplateID, OptionValue, SortOrder)
        VALUES (@InfoTemplateID, @OptionValue, @SortOrder);
      `);
  }
}

async function insertInfoValue(
  tx: sql.Transaction,
  infoTemplateId: number,
  sheetId: number,
  value: string
): Promise<void> {
  await tx.request()
    .input("InfoTemplateID", sql.Int,      infoTemplateId)
    .input("SheetID",        sql.Int,      sheetId)
    .input("InfoValue",      sql.VarChar(sql.MAX), value)
    .query(`
      INSERT INTO InformationValues (InfoTemplateID, SheetID, InfoValue)
      VALUES (@InfoTemplateID, @SheetID, @InfoValue);
    `);
}

/* ────────────── helpers: audit / notify ────────────── */

async function writeAuditAndNotify(
  sheetId: number,
  data: UnifiedSheet & { fieldValues: Record<string, string> },
  context: AuditContext
): Promise<void> {
  if (context?.userId) {
    await insertAuditLog({
      PerformedBy: context.userId,
      TableName: "Sheets",
      RecordID: sheetId,
      Action: "Create Filled Sheet",
      Route: context.route ?? null,
      Method: context.method ?? null,
      StatusCode: 201,
      Changes: JSON.stringify(data),
    });
  }

  await notifyUsers({
    recipientRoleIds: [1, 2],
    sheetId,
    title: "New Filled Sheet Created",
    message: `Filled sheet #${sheetId} has been created by User #${context.userId}.`,
    category: "Datasheet",
    createdBy: context.userId,
  });
}

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

// Not being called right now, but useful when we need TemplateID of a SheetID
export async function getFilledSheetTemplateId(sheetId: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT TemplateID FROM Sheets WHERE SheetID = @SheetID`);
  return result.recordset[0];
}

export async function getFilledSheetDetailsById(
  sheetId: number,
  lang: string = "eng",
  uom: "SI" | "USC" = "SI"
) {
  const pool = await poolPromise;

  const sheetResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT 
        s.*, 
        s.RevisionNum, 
        u1.FirstName + ' ' + u1.LastName AS preparedByName,
        u2.FirstName + ' ' + u2.LastName AS verifiedByName,
        u3.FirstName + ' ' + u3.LastName AS approvedByName,
        u4.FirstName + ' ' + u4.LastName AS modifiedByName,
        u5.FirstName + ' ' + u5.LastName AS rejectedByName,
        a.AreaName,
        m.ManuName AS manuName,
        sup.SuppName AS suppName,
        cat.CategoryName,
        c.ClientName,
        c.ClientLogo,
        p.ProjName AS projectName
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

  const datasheet: UnifiedSheet = buildUnifiedSheetFromRow(row);

  const templatesResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("TemplateID", sql.Int, row.TemplateID)
    .query(`
      SELECT 
        sub.SubID,
        sub.SubName,
        t.InfoTemplateID,
        t.Label,
        t.InfoType,
        t.UOM,
        t.Required,
        t.OrderIndex AS SortOrder,
        iv.InfoValue AS Value,
        ts.SubID AS TemplateSubID,
        t.TemplateInfoTemplateID AS TemplateInfoTemplateID
      FROM Subsheets sub
      INNER JOIN InformationTemplates t ON sub.SubID = t.SubID
      LEFT JOIN InformationValues iv ON t.InfoTemplateID = iv.InfoTemplateID AND iv.SheetID = @SheetID
      LEFT JOIN Subsheets ts ON ts.SheetID = @TemplateID AND ts.SubName = sub.SubName
      LEFT JOIN InformationTemplates tt ON tt.SubID = ts.SubID AND tt.OrderIndex = t.OrderIndex
      WHERE sub.SheetID = @SheetID
      ORDER BY sub.OrderIndex, t.OrderIndex;
    `);

  const optionsResult = await pool.request().query(`
    SELECT InfoTemplateID, OptionValue
    FROM InformationTemplateOptions
    ORDER BY InfoTemplateID, SortOrder;
  `);

  const optionMap: Record<number, Record<string, string>> = {};
  for (const row of optionsResult.recordset) {
    if (!optionMap[row.InfoTemplateID]) optionMap[row.InfoTemplateID] = {};
    const count = Object.keys(optionMap[row.InfoTemplateID]).length;
    optionMap[row.InfoTemplateID][String(count)] = row.OptionValue;
  }

  const rows = templatesResult.recordset;
  const subsheetsMap = new Map<number, UnifiedSubsheet>();

  for (const row of rows) {
    const originalSubId = row.TemplateSubID ?? row.SubID;
    const originalFieldId = row.TemplateInfoTemplateID ?? row.InfoTemplateID;

    if (!subsheetsMap.has(originalSubId)) {
      subsheetsMap.set(originalSubId, {
        id: row.SubID,
        originalId: row.TemplateSubID,
        name: row.SubName,
        fields: [],
      });
    }

    // Perform unit conversion if needed
    let value = row.Value ?? undefined;
    let displayUom = row.UOM ?? undefined;
    if (uom === "USC" && row.UOM && value !== undefined) {
      const result = convertToUSC(value, row.UOM);
      if (result) {
        value = result.value;
        displayUom = result.unit;
      }
    }

    const field = {
      id: row.InfoTemplateID,
      templateInfoTemplateID: row.TemplateInfoTemplateID,
      originalId: originalFieldId,
      label: row.Label,
      infoType: row.InfoType,
      uom: displayUom,
      sortOrder: row.SortOrder,
      required: Boolean(row.Required),
      options: Object.values(optionMap[row.InfoTemplateID] ?? {}),
      value,
    };

    subsheetsMap.get(originalSubId)!.fields.push(field);
  }

  datasheet.subsheets = Array.from(subsheetsMap.values());

  // ─────────────────────────────────────────────────────────────
  //  NEW: NOTES
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
    .input("SheetID", sql.Int, sheetId)
    .query<NoteRow>(`
      SELECT
        n.NoteID       AS id,
        n.NoteTypeID   AS noteTypeId,
        nt.NoteType    AS noteTypeName,            -- ★ pull the display name
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

  const notes: SheetNoteDTO[] = notesResult.recordset.map((r) => ({
    id: r.id,
    noteTypeId: r.noteTypeId,
    noteTypeName: r.noteTypeName ?? null,          // ★ include the name
    orderIndex: r.orderIndex,
    body: r.body ?? "",
    createdAt: r.createdAt ? new Date(r.createdAt as unknown as string).toISOString() : "",
    createdBy: r.createdBy,
    createdByName: r.createdByName ?? null,
  }));

  (datasheet as typeof datasheet & { notes: SheetNoteDTO[] }).notes = notes;

  // ─────────────────────────────────────────────────────────────
  //  NEW: ATTACHMENTS (SheetAttachments → Attachments)
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
    .input("SheetID", sql.Int, sheetId)
    .query(`
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
      FROM SheetAttachments sa
      INNER JOIN Attachments a
        ON a.AttachmentID = sa.AttachmentID
      LEFT JOIN Users u
        ON u.UserID = a.UploadedBy
      WHERE sa.SheetID = @SheetID
      ORDER BY sa.OrderIndex ASC, a.UploadedAt DESC
    `);

  const attRows: AttachmentRow[] = attsResult.recordset as AttachmentRow[];
  const attachments: SheetAttachmentDTO[] = attRows.map((r) => {
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

  if (lang !== "eng") {
    const translations = await getSheetTranslations(row.TemplateID, lang);
    const translatedSheet = applySheetTranslations(datasheet, translations) as typeof datasheet & {
      notes: SheetNoteDTO[];
      attachments: SheetAttachmentDTO[];
    };

    // Preserve arrays after translation
    translatedSheet.notes = (datasheet as typeof translatedSheet).notes;
    translatedSheet.attachments = (datasheet as typeof translatedSheet).attachments;

    return { datasheet: translatedSheet, translations };
  }

  return { datasheet, translations: null };
}

interface RawSheetRow {
  SheetID: number;
  SheetName: string;
  SheetDesc: string;
  SheetDesc2: string;
  ClientID: number;
  ClientName: string;
  ClientLogo: string;
  ClientProjNum: string;
  ClientDocNum: string;
  CompanyDocNum: string;
  CompanyProjNum: string;
  AreaID: number;
  AreaName: string;
  PackageName: string;
  RevisionNum: number;
  RevisionDate: Date | null;
  PreparedByID: number;
  preparedByName: string;
  PreparedByDate: Date | null;
  VerifiedByID: number | null;
  verifiedByName: string | null;
  VerifiedByDate: Date | null;
  ApprovedByID: number | null;
  approvedByName: string | null;
  ApprovedByDate: Date | null;
  RejectedByID: number | null;
  rejectedByName: string | null;
  RejectedByDate: Date | null;
  ModifiedByID: number | null;
  modifiedByName: string | null;
  ModifiedByDate: Date | null;
  IsTemplate: boolean;
  IsLatest: boolean;
  Status: string;
  RejectComment: string | null;
  ItemLocation: string;
  RequiredQty: number;
  EquipmentName: string;
  EquipmentTagNum: string;
  ServiceName: string;
  ManuID: number;
  manuName: string;
  SuppID: number;
  suppName: string;
  InstallPackNum: string;
  EquipSize: string;
  ModelNum: string;
  Driver: string;
  LocationDwg: string;
  PID: string;
  InstallDwg: string;
  CodeStd: string;
  CategoryID: number;
  CategoryName: string;
  ProjectID: number;
  projectName: string;
  TemplateID: number;
  ParentSheetID: number;
}


function buildUnifiedSheetFromRow(row: RawSheetRow): UnifiedSheet {
  return {
    sheetId: row.SheetID,
    sheetName: row.SheetName,
    sheetDesc: row.SheetDesc,
    sheetDesc2: row.SheetDesc2,
    clientId: row.ClientID,
    clientName: row.ClientName,
    clientLogo: row.ClientLogo,
    clientProjectNum: Number(row.ClientProjNum),
    clientDocNum: Number(row.ClientDocNum),
    companyDocNum: Number(row.CompanyDocNum),
    companyProjectNum: Number(row.CompanyProjNum),
    areaId: row.AreaID,
    areaName: row.AreaName,
    packageName: row.PackageName,
    revisionNum: Array.isArray(row.RevisionNum) ? row.RevisionNum[0] : row.RevisionNum,
    revisionDate: row.RevisionDate?.toISOString().split("T")[0] ?? "",
    preparedById: row.PreparedByID,
    preparedByName: row.preparedByName,
    preparedByDate: row.PreparedByDate?.toISOString().split("T")[0] ?? "",
    verifiedById: row.VerifiedByID,
    verifiedByName: row.verifiedByName ?? undefined,
    verifiedDate: row.VerifiedByDate?.toISOString().split("T")[0] ?? "",
    approvedById: row.ApprovedByID,
    approvedByName: row.approvedByName ?? undefined,
    approvedDate: row.ApprovedByDate?.toISOString().split("T")[0] ?? "",
    rejectedById: row.RejectedByID ?? undefined,
    rejectedByName: row.rejectedByName ?? undefined,
    rejectedByDate: row.RejectedByDate?.toISOString().split("T")[0] ?? "",
    modifiedById: row.ModifiedByID ?? undefined,
    modifiedByName: row.modifiedByName ?? undefined,
    modifiedByDate: row.ModifiedByDate?.toISOString().split("T")[0] ?? "",
    isTemplate: row.IsTemplate,
    isLatest: row.IsLatest,
    status: (["Draft", "Rejected", "Modified Draft", "Verified", "Approved"].includes(row.Status) ? (row.Status as SheetStatus) : "Draft"),
    rejectComment: row.RejectComment ?? undefined,
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
    equipSize: Number(row.EquipSize), 
    modelNum: row.ModelNum,
    driver: row.Driver,
    locationDwg: row.LocationDwg,
    pid: Number(row.PID), 
    installDwg: row.InstallDwg,
    codeStd: row.CodeStd,
    categoryId: row.CategoryID,
    categoryName: row.CategoryName,
    projectId: row.ProjectID,
    projectName: row.projectName,
    templateId: row.TemplateID,
    parentSheetId: row.ParentSheetID,
    sourceFilePath: null,
    subsheets: [],
  };
}

export const updateFilledSheet = async (
  sheetId: number,
  input: UnifiedSheet,
  updatedBy: number
): Promise<{ sheetId: number }> => {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    const request = transaction.request();

    request.input("SheetID", sheetId);
    request.input("SheetName", input.sheetName);
    request.input("SheetDesc", input.sheetDesc);
    request.input("SheetDesc2", input.sheetDesc2);
    request.input("ClientDocNum", input.clientDocNum);
    request.input("ClientProjNum", input.clientProjectNum);
    request.input("CompanyDocNum", input.companyDocNum);
    request.input("CompanyProjNum", input.companyProjectNum);
    request.input("AreaID", input.areaId);
    request.input("PackageName", input.packageName);
    request.input("RevisionNum", input.revisionNum);
    request.input("RevisionDate", input.revisionDate);
    request.input("ItemLocation", input.itemLocation);
    request.input("RequiredQty", input.requiredQty);
    request.input("EquipmentName", input.equipmentName);
    request.input("EquipmentTagNum", input.equipmentTagNum);
    request.input("ServiceName", input.serviceName);
    request.input("ManuID", input.manuId);
    request.input("SuppID", input.suppId);
    request.input("InstallPackNum", input.installPackNum);
    request.input("EquipSize", input.equipSize);
    request.input("ModelNum", input.modelNum);
    request.input("Driver", input.driver);
    request.input("LocationDWG", input.locationDwg);
    request.input("PID", input.pid);
    request.input("InstallDWG", input.installDwg);
    request.input("CodeStd", input.codeStd);
    request.input("CategoryID", input.categoryId);
    request.input("ClientID", input.clientId);
    request.input("ProjectID", input.projectId);
    request.input("ModifiedByID", updatedBy);

    await request.query(`
      UPDATE Sheets SET
        SheetName = @SheetName,
        SheetDesc = @SheetDesc,
        SheetDesc2 = @SheetDesc2,
        ClientDocNum = @ClientDocNum,
        ClientProjNum = @ClientProjNum,
        CompanyDocNum = @CompanyDocNum,
        CompanyProjNum = @CompanyProjNum,
        AreaID = @AreaID,
        PackageName = @PackageName,
        RevisionNum = @RevisionNum,
        RevisionDate = @RevisionDate,
        ItemLocation = @ItemLocation,
        RequiredQty = @RequiredQty,
        EquipmentName = @EquipmentName,
        EquipmentTagNum = @EquipmentTagNum,
        ServiceName = @ServiceName,
        ManuID = @ManuID,
        SuppID = @SuppID,
        InstallPackNum = @InstallPackNum,
        EquipSize = @EquipSize,
        ModelNum = @ModelNum,
        Driver = @Driver,
        LocationDWG = @LocationDWG,
        PID = @PID,
        InstallDWG = @InstallDWG,
        CodeStd = @CodeStd,
        CategoryID = @CategoryID,
        ClientID = @ClientID,
        ProjectID = @ProjectID,
        ModifiedByID = @ModifiedByID,
        ModifiedByDate = GETDATE(),
        Status = 'Modified Draft'
      WHERE SheetID = @SheetID
    `);

    const oldValuesResult = await transaction.request()
      .input("SheetID", sql.Int, sheetId)
      .query(`
        SELECT IV.InfoTemplateID, IV.InfoValue, IT.Label, IT.UOM
        FROM InformationValues IV
        JOIN InformationTemplates IT ON IV.InfoTemplateID = IT.InfoTemplateID
        WHERE SheetID = @SheetID
      `);

    const oldValuesMap = new Map<number, { value: string; label: string; uom: string | null }>();
    for (const row of oldValuesResult.recordset) {
      oldValuesMap.set(row.InfoTemplateID, {
        value: row.InfoValue,
        label: row.Label,
        uom: row.UOM,
      });
    }

    await transaction.request().query(`
      DELETE FROM InformationValues WHERE SheetID = ${sheetId}
    `);

    const insertedTemplateIds = new Set<number>();

    for (const subsheet of input.subsheets) {
      for (const field of subsheet.fields) {
        const templateId = field.id;
        if (!templateId || insertedTemplateIds.has(templateId)) continue;

        insertedTemplateIds.add(templateId);
        const newValue = field.value ?? "";

        await transaction.request()
          .input("InfoTemplateID", sql.Int, templateId)
          .input("SheetID", sql.Int, sheetId)
          .input("InfoValue", sql.VarChar(sql.MAX), newValue)
          .query(`
            INSERT INTO InformationValues (InfoTemplateID, SheetID, InfoValue)
            VALUES (@InfoTemplateID, @SheetID, @InfoValue)
          `);

        const previous = oldValuesMap.get(templateId);
        if (previous && previous.value !== newValue) {
          await transaction.request()
            .input("SheetID", sql.Int, sheetId)
            .input("ChangedBy", sql.Int, updatedBy)
            .input("InfoTemplateID", sql.Int, templateId)
            .input("OldValue", sql.VarChar(sql.MAX), previous.value)
            .input("NewValue", sql.VarChar(sql.MAX), newValue)
            .input("UOM", sql.VarChar(100), previous.uom)
            .query(`
              INSERT INTO ChangeLogs (
                SheetID, ChangedBy, InfoTemplateID,
                OldValue, NewValue, UOM, ChangeDate
              ) VALUES (
                @SheetID, @ChangedBy, @InfoTemplateID,
                @OldValue, @NewValue, @UOM, GETDATE()
              )
            `);
        }
      }
    }

    await insertAuditLog({
      PerformedBy: updatedBy,
      TableName: "Sheets",
      RecordID: sheetId,
      Action: "Update Filled Sheet",
    });

    await notifyUsers({
      recipientRoleIds: [1, 2],
      sheetId,
      title: "Filled Datasheet Updated",
      message: `Sheet #${sheetId} has been updated.`,
      category: "Datasheet",
      createdBy: updatedBy,
    });

    await transaction.commit();
    return { sheetId };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

export async function verifyFilledSheet(
  sheetId: number,
  action: "verify" | "reject",
  rejectionComment: string | undefined,
  verifierId: number
) {
  const pool = await poolPromise;
  const status = action === "verify" ? "Verified" : "Rejected";

  // 🔹 1. Get verifier's first name
  const userResult = await pool
    .request()
    .input("UserID", sql.Int, verifierId)
    .query(`SELECT FirstName FROM Users WHERE UserID = @UserID`);

  const verifierName = userResult.recordset[0]?.FirstName || `User #${verifierId}`;

  // 🔹 2. Build and execute update query for Sheets
  const request = pool.request()
    .input("SheetID", sql.Int, sheetId)
    .input("Status", sql.VarChar, status);

  if (action === "verify") {
    request
      .input("VerifiedByID", sql.Int, verifierId)
      .input("VerifiedByDate", sql.DateTime, new Date());

    await request.query(`
      UPDATE Sheets
      SET 
        Status = @Status,
        VerifiedByID = @VerifiedByID,
        VerifiedByDate = @VerifiedByDate
      WHERE SheetID = @SheetID
    `);
  } else {
    request
      .input("RejectedByID", sql.Int, verifierId)
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
    PerformedBy: verifierId,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: action === "verify" ? "Verify Filled Sheet" : "Reject Filled Sheet",
  });

  // 🔹 4. Notify Admins
  await notifyUsers({
    recipientRoleIds: [1], // Admins
    sheetId,
    title: `Filled Sheet ${status}`,
    message: `Filled sheet #${sheetId} has been ${status.toLowerCase()} by ${verifierName}.`,
    category: "Datasheet",
    createdBy: verifierId,
  });

  // 🔹 5. Notify the engineer (PreparedByID)
  const engineerResult = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT PreparedByID FROM Sheets WHERE SheetID = @SheetID`);

  const preparedById = engineerResult.recordset[0]?.PreparedByID;

  if (preparedById) {
    await notifyUsers({
      recipientUserIds: [preparedById],
      sheetId,
      title: `Your filled sheet was ${status.toLowerCase()}`,
      message: `Your filled sheet #${sheetId} has been ${status.toLowerCase()} by ${verifierName}.`,
      category: "Datasheet",
      createdBy: verifierId,
    });
  }
}

export async function approveFilledSheet(sheetId: number, approvedById: number): Promise<number> {
  const pool = await poolPromise;

  // 🔹 Update the filled sheet
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
      WHERE SheetID = @SheetID AND IsTemplate = 0
    `);

  // 🔍 Check if update affected any row
  if (updateResult.rowsAffected[0] === 0) {
    console.warn(`⚠️ No filled sheet found or updated for SheetID: ${sheetId}`);
    throw new Error("Filled sheet not found or already approved.");
  }

  // ✅ Insert audit log
  await insertAuditLog({
    PerformedBy: approvedById,
    TableName: "Sheets",
    RecordID: sheetId,
    Action: "Approve Filled Sheet",
  });

  // 🔍 Fetch engineer (creator)
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
        category: "Datasheet",
        title: "Filled Sheet Approved",
        message: `Your filled sheet #${sheetId} has been approved.`,
      });
    } catch (err) {
      console.error("❌ Failed to send approval notification:", err);
    }
  } else {
    console.warn(`⚠️ No PreparedByID found for Filled SheetID: ${sheetId}`);
  }

  return sheetId;
}

export const fetchReferenceOptions = async () => {
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

/* ──────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────── */

/** Per-project uniqueness check for equipment tag */
export async function doesEquipmentTagExist(tag: string, projectId: number): Promise<boolean> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("ProjectID", sql.Int, projectId);
  req.input("Tag", sql.NVarChar, tag);

  const rs = await req.query<{ Exists: number }>(`
    SELECT TOP 1 1 AS Exists
    FROM Sheets
    WHERE IsTemplate = 0 AND ProjectID = @ProjectID AND EquipmentTagNum = @Tag
  `);
  return (rs.recordset?.length ?? 0) > 0;
}

/* ──────────────────────────────────────────────────────────────
   Attachments
   NOTE: Column names below follow the INSERT/SELECT style you used
         in your clone logic (FileName, FileUrl, MimeType, Size, StorageKey).
         If your actual schema differs, adjust the column names accordingly.
   ────────────────────────────────────────────────────────────── */

/** Save attachment metadata after Multer writes the file to /public/attachments */
export async function saveAttachmentMeta(meta: AttachmentMeta): Promise<AttachmentMeta & { attachmentId: number }> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("SheetID", sql.Int, meta.sheetId);
  req.input("FileName", sql.NVarChar, meta.originalName);
  req.input("FileUrl", sql.NVarChar, meta.relativePath); // store relative path (e.g., "attachments/123_name.pdf")
  req.input("MimeType", sql.NVarChar, meta.mimeType);
  req.input("Size", sql.BigInt, meta.size);
  req.input("StorageKey", sql.NVarChar, null); // If you add S3 keys later, set here
  req.input("UploadedBy", sql.Int, meta.uploadedBy);

  const rs = await req.query<{ AttachmentID: number }>(`
    INSERT INTO Attachments (
      SheetID, FileName, FileUrl, MimeType, Size, StorageKey, UploadedBy, UploadedAt, IsReference
    )
    VALUES (
      @SheetID, @FileName, @FileUrl, @MimeType, @Size, @StorageKey, @UploadedBy, GETDATE(), 0
    );
    SELECT CAST(SCOPE_IDENTITY() AS int) AS AttachmentID;
  `);

  const attachmentId = rs.recordset?.[0]?.AttachmentID ?? 0;
  return { ...meta, attachmentId };
}

/** List attachments for a sheet (most recent first) */
export async function getAttachmentsForSheet(sheetId: number): Promise<Array<AttachmentMeta & { attachmentId: number }>> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("SheetID", sql.Int, sheetId);

  const rs = await req.query<{
    AttachmentID: number;
    SheetID: number;
    FileName: string;
    FileUrl: string;
    MimeType: string | null;
    Size: number | null;
    UploadedBy: number | null;
    UploadedAt: Date | null;
  }>(`
    SELECT AttachmentID, SheetID, FileName, FileUrl, MimeType, Size, UploadedBy, UploadedAt
    FROM Attachments
    WHERE SheetID = @SheetID
    ORDER BY UploadedAt DESC, AttachmentID DESC
  `);

  const items = (rs.recordset ?? []).map(r => ({
    attachmentId: r.AttachmentID,
    sheetId: r.SheetID,
    originalName: r.FileName,
    storedName: path.basename(r.FileUrl || ""),
    size: Number(r.Size ?? 0),
    mimeType: r.MimeType ?? "application/octet-stream",
    relativePath: r.FileUrl || "",
    uploadedBy: Number(r.UploadedBy ?? 0),
    createdAt: r.UploadedAt ? new Date(r.UploadedAt).toISOString() : undefined,
  }));
  return items;
}

/** Delete attachment by id (keeps DB/FS policy simple; delete row, you may also remove the file if desired) */
export async function deleteAttachmentById(sheetId: number, attachmentId: number): Promise<void> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("SheetID", sql.Int, sheetId);
  req.input("AttachmentID", sql.Int, attachmentId);

  await req.query(`
    DELETE FROM Attachments WHERE AttachmentID = @AttachmentID AND SheetID = @SheetID
  `);

  // If you also want to remove the physical file under /public/attachments,
  // you can SELECT FileUrl before deletion and unlinkSync(path.resolve("public", FileUrl)).
  // (Left out here to avoid FS side-effects in the service.)
}

/* ──────────────────────────────────────────────────────────────
   Notes
   ────────────────────────────────────────────────────────────── */

/** List notes for a sheet (most recent first) */
export async function getNotesForSheet(sheetId: number): Promise<Array<{
  noteId: number;
  sheetId: number;
  text: string;
  createdBy: number;
  createdAt: string;
  updatedBy?: number;
  updatedAt?: string;
}>> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("SheetID", sql.Int, sheetId);

  const rs = await req.query<{
    NoteID: number;
    SheetID: number;
    Text: string;
    CreatedBy: number;
    CreatedAt: Date;
    UpdatedBy: number | null;
    UpdatedAt: Date | null;
  }>(`
    SELECT NoteID, SheetID, Text, CreatedBy, CreatedAt, UpdatedBy, UpdatedAt
    FROM SheetNotes
    WHERE SheetID = @SheetID
    ORDER BY CreatedAt DESC, NoteID DESC
  `);

  return (rs.recordset ?? []).map(r => ({
    noteId: r.NoteID,
    sheetId: r.SheetID,
    text: r.Text,
    createdBy: r.CreatedBy,
    createdAt: new Date(r.CreatedAt).toISOString(),
    updatedBy: r.UpdatedBy ?? undefined,
    updatedAt: r.UpdatedAt ? new Date(r.UpdatedAt).toISOString() : undefined,
  }));
}

/** Create a note for a sheet */
export async function createNoteForSheet(sheetId: number, payload: NoteCreatePayload, userId: number): Promise<{
  noteId: number;
  sheetId: number;
  text: string;
  createdBy: number;
  createdAt: string;
}> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("SheetID", sql.Int, sheetId);
  req.input("Text", sql.NVarChar, payload.text);
  req.input("CreatedBy", sql.Int, userId);

  const rs = await req.query<{ NoteID: number; CreatedAt: Date }>(`
    INSERT INTO SheetNotes (SheetID, Text, CreatedBy, CreatedAt)
    VALUES (@SheetID, @Text, @CreatedBy, GETDATE());
    SELECT CAST(SCOPE_IDENTITY() AS int) AS NoteID, GETDATE() AS CreatedAt;
  `);

  const row = rs.recordset?.[0];
  return {
    noteId: row?.NoteID ?? 0,
    sheetId,
    text: payload.text,
    createdBy: userId,
    createdAt: row?.CreatedAt ? new Date(row.CreatedAt).toISOString() : new Date().toISOString(),
  };
}

/** Update a note (text only) */
export async function updateNoteForSheet(
  sheetId: number,
  noteId: number,
  payload: NoteUpdatePayload,
  userId: number
): Promise<{
  noteId: number;
  sheetId: number;
  text: string;
  updatedBy: number;
  updatedAt: string;
}> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("SheetID", sql.Int, sheetId);
  req.input("NoteID", sql.Int, noteId);
  req.input("Text", sql.NVarChar, payload.text ?? "");

  const rs = await req.query<{ UpdatedAt: Date }>(`
    UPDATE SheetNotes
    SET Text = @Text, UpdatedBy = ${userId}, UpdatedAt = GETDATE()
    WHERE NoteID = @NoteID AND SheetID = @SheetID;

    SELECT GETDATE() AS UpdatedAt;
  `);

  const row = rs.recordset?.[0];
  return {
    noteId,
    sheetId,
    text: payload.text ?? "",
    updatedBy: userId,
    updatedAt: row?.UpdatedAt ? new Date(row.UpdatedAt).toISOString() : new Date().toISOString(),
  };
}

/** Delete a note */
export async function deleteNoteForSheet(sheetId: number, noteId: number): Promise<void> {
  const pool = await poolPromise;
  const req = pool.request();
  req.input("SheetID", sql.Int, sheetId);
  req.input("NoteID", sql.Int, noteId);

  await req.query(`
    DELETE FROM SheetNotes WHERE NoteID = @NoteID AND SheetID = @SheetID
  `);

  // Optional: insert an audit log here using insertAuditLog(...)
}

/* ──────────────────────────────────────────────────────────────
   Export helpers (return absolute file path; controller sendsFile)
   ────────────────────────────────────────────────────────────── */

export async function exportPDF(
  sheetId: number,
  lang: string = "eng",
  uom: UOM = "SI"
): Promise<string> {
  const dir = path.resolve(process.cwd(), "public", "exports");
  await ensureDir(dir);
  const outPath = path.join(dir, `sheet_${sheetId}.pdf`);

  // getFilledSheetDetailsById can return null → guard it
  const details = await getFilledSheetDetailsById(sheetId, lang, uom);
  if (!details) {
    throw new Error(`Sheet ${sheetId} not found`);
  }
  const { datasheet } = details; // now safe

  // Your generator expects 3 args (datasheet, lang, uom)
  const result = await generateDatasheetPDF(datasheet, lang, uom);

  return normalizeToPath(result, outPath);
}

export async function exportExcel(
  sheetId: number,
  lang: string = "eng",
  uom: UOM = "SI"
): Promise<string> {
  const dir = path.resolve(process.cwd(), "public", "exports");
  await ensureDir(dir);
  const outPath = path.join(dir, `sheet_${sheetId}.xlsx`);

  const details = await getFilledSheetDetailsById(sheetId, lang, uom);
  if (!details) {
    throw new Error(`Sheet ${sheetId} not found`);
  }
  const { datasheet } = details;

  // Your generator expects 3 args (datasheet, lang, uom)
  const result = await generateDatasheetExcel(datasheet, lang, uom);

  return normalizeToPath(result, outPath);
}

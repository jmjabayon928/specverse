// src/domain/datasheets/sheet.ts

// ---------------- Existing types (kept) ----------------
export type InfoType = "int" | "decimal" | "varchar";
export type SheetMode = "create" | "edit" | "view" | "verify" | "approve";

export interface TemplateSubsheet {
  id: number;
  name: string;
}

export interface TemplateField {
  id: number;
  label: string;
  subId: number | null;
}

export interface TemplateStructure {
  subsheets: TemplateSubsheet[];
  fields: TemplateField[];
}

export interface InfoField {
  id?: number;           // Filled InfoTemplateID
  originalId?: number;   // ✅ Template InfoTemplateID
  label: string;
  infoType: InfoType;
  uom?: string;
  sortOrder: number;
  required: boolean;
  options?: string[];
  value?: string | number | null;
}

export interface UnifiedSubsheet {
  id?: number;           // Filled SubID
  originalId?: number;   // ✅ Template SubID
  name: string;
  fields: InfoField[];
}

export interface UnifiedSheet {
  // Core Identifiers
  sheetId?: number;
  sheetName: string;
  sheetDesc: string;
  sheetDesc2?: string;
  isLatest?: boolean;
  isTemplate?: boolean;
  autoCADImport?: boolean;
  status?: "Draft" | "Rejected" | "Modified Draft" | "Verified" | "Approved";
  rejectComment?: string;

  // Reference IDs + human-readable names
  areaId: number;
  areaName?: string;

  manuId: number;
  manuName?: string;

  suppId: number;
  suppName?: string;

  categoryId: number;
  categoryName?: string;

  clientId: number;
  clientName?: string;
  clientLogo?: string | null;

  projectId: number;
  projectName?: string;

  pid?: number;

  // Document Numbers
  clientDocNum: number;
  clientProjectNum: number;
  companyDocNum: number;
  companyProjectNum: number;

  // Revision Info
  revisionNum: number;
  revisionDate: string;

  // Equipment
  equipmentName: string;
  equipmentTagNum: string;
  serviceName: string;
  requiredQty: number;
  itemLocation: string;
  installPackNum?: string;
  equipSize: number;
  modelNum?: string;
  driver?: string;
  locationDwg?: string;
  installDwg?: string;
  codeStd?: string;

  // Workflow: Prepared
  preparedById: number;
  preparedByName?: string;
  preparedByDate: string;

  // Workflow: Verified
  verifiedById?: number | null;
  verifiedByName?: string;
  verifiedDate?: string | null;

  // Workflow: Approved
  approvedById?: number | null;
  approvedByName?: string;
  approvedDate?: string | null;

  // Workflow: Modified
  modifiedById?: number;
  modifiedByName?: string;
  modifiedByDate?: string;

  // Workflow: Rejected
  rejectedById?: number;
  rejectedByName?: string;
  rejectedByDate?: string;

  // Misc
  packageName: string;

  // Relations (optional but useful)
  templateId?: number;
  parentSheetId?: number;

  // Audit
  sourceFilePath?: string | null;

  // Nested data
  subsheets: UnifiedSubsheet[];
  informationValues?: Record<string, string>;
}

export interface MinimalSheetForActions {
  sheetId: number;
  status: "Draft" | "Rejected" | "Modified Draft" | "Verified" | "Approved";
  preparedBy: number;
  isTemplate: boolean;
}

export type DatasheetField = keyof UnifiedSheet;

// Used when creating or updating a full template
export type TemplateInput = {
  datasheet: {
    sheetName: string;
    sheetDesc: string;
    sheetDesc2?: string;
    clientId: number;
    clientDocNum: number;
    clientProjectNum: number;
    companyDocNum: number;
    companyProjectNum: number;
    areaId: number;
    packageName: string;
    revisionNum: number;
    revisionDate: string;
    equipmentName: string;
    equipmentTagNum: string;
    serviceName: string;
    requiredQty: number;
    itemLocation: string;
    manuId: number;
    suppId: number;
    installPackNum?: string;
    equipSize: number;
    modelNum?: string;
    driver?: string;
    locationDwg?: string;
    pid?: number;
    installDwg?: string;
    codeStd?: string;
    categoryId: number;
    projectId: number;
  };
  subsheets: UnifiedSubsheet[];
};

// Used by forms to also include isTemplate flag
export type FullTemplateInput = TemplateInput & {
  isTemplate: boolean;
};

export type SheetStatus = "Draft" | "Rejected" | "Modified Draft" | "Verified" | "Approved";

// ---------------- New, shared feature types ----------------

// Notes (applies to both templates and filled sheets)
export interface DatasheetNote {
  noteId: number;
  sheetId: number;           // references any row in Sheets (template or filled)
  text: string;
  createdBy: number;
  createdAt: string;         // ISO string
  updatedBy?: number;
  updatedAt?: string;        // ISO string
}

export interface NoteCreatePayload {
  text: string;
}

export interface NoteUpdatePayload {
  text?: string;
}

// Attachments (applies to both templates and filled sheets)
export interface AttachmentMeta {
  attachmentId?: number;
  sheetId: number;           // references any row in Sheets (template or filled)
  originalName: string;
  storedName: string;
  size: number;
  mimeType: string;
  // For local filesystem storage under public/attachments
  relativePath: string;      // e.g. "attachments/1695752100000_specs.pdf"
  uploadedBy: number;
  createdAt?: string;        // ISO string
}

// ---------------- Create/Update/Clone payloads ----------------

// When creating a new filled sheet from the UI/API.
// If you prefer a narrower DTO, you can replace 'UnifiedSheet' with a subset.
export interface CreateFilledSheetBody extends UnifiedSheet {
  fieldValues?: Record<string, string>;
  isTemplate?: boolean;      // controller/service should force false for filled
}

// When updating an existing filled sheet (PATCH/PUT)
export type UpdateFilledSheetBody = Partial<UnifiedSheet> & {
  fieldValues?: Record<string, string>;
};

// Minimal overrides when cloning a sheet.
// Controller will ensure required fields (e.g., equipmentTagNum, projectId) before service call.
export interface CloneFilledSheetBody {
  equipmentTagNum?: string | null;
  projectId?: number | string;
  fieldValues?: Record<string, string>;
  // Add any extra overridable fields here if you allow them during clone
}

// Service result after creation
export interface CreateFilledSheetResult {
  sheetId: number;
}

export type NoteType = {
  noteTypeId: number;
  noteType: string;
  description: string | null;
};

/** Note row returned for a sheet/template. */
export type SheetNoteDTO = {
  /** PK: SheetNotes.NoteID */
  id: number;
  /** FK: SheetNotes.NoteTypeID */
  noteTypeId: number | null;
  /** Optional display name (JOIN NoteTypes.NoteType) */
  noteTypeName?: string | null;
  /** Ordering within the sheet */
  orderIndex: number | null;
  /** Note body text */
  body: string;
  /** ISO timestamp */
  createdAt: string;
  /** Author (optional) */
  createdBy?: number | null;
  /** Author’s display name (optional) */
  createdByName?: string | null;
};

/** Attachment linked to a sheet/template via SheetAttachments. */
export type SheetAttachmentDTO = {
  // Link table fields (SheetAttachments)
  sheetAttachmentId: number;
  orderIndex: number;
  isFromTemplate: boolean;
  linkedFromSheetId?: number | null;
  cloneOnCreate: boolean;

  // File fields (Attachments)
  id: number;
  originalName: string;
  storedName: string;
  contentType: string;
  fileSizeBytes: number;
  storageProvider: string;   // e.g., 'local', 's3'
  storagePath: string;       // provider-specific path/key
  sha256?: string | null;
  uploadedBy?: number | null;
  uploadedByName?: string | null;
  /** ISO timestamp */
  uploadedAt: string;
  isViewable: boolean;

  /** Derived download/preview URL */
  fileUrl?: string;
};

/** Payload for adding an attachment via multer (service layer). */
export type AddSheetAttachmentArgs = {
  sheetId: number;
  file: Express.Multer.File;
  uploadedBy: number;
  ensureTemplate?: boolean;
};

/** Result returned to the controller/UI after saving an attachment. */
export type AddSheetAttachmentResult = {
  attachmentId: number;
  sheetAttachmentId: number;
  orderIndex: number;
  originalName: string;
  storedName: string;
  contentType: string;
  fileSizeBytes: number;
  storageProvider: "local" | "s3"; // extend if needed
  storagePath: string;             // e.g. "attachments/filename.ext" or S3 key
  isViewable: boolean;
  uploadedAt: string;              // ISO
  fileUrl: string;                 // usable preview/download URL
};
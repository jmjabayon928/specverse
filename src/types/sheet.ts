// src/types/sheet.ts

export type InfoType = "int" | "decimal" | "varchar";
export type SheetMode = "create" | "edit" | "view" | "verify" | "approve";

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
  isSuperseded?: boolean;
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

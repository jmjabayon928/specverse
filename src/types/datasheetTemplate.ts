// src/types/datasheetTemplate.ts
export type TemplateField = {
  id: number;                   // local frontend ID (Date.now())
  name: string;                 // label
  type: "varchar" | "int" | "decimal";   // only these types allowed
  uom: string;                  // any SI unit (or blank)
  options?: string[];           // ✅ for dropdowns; optional
};

export type Subsheet = {
  id: number;
  name: string;
  templates: TemplateField[];
};

export type Equipment = {
  equipmentName: string;
  equipmentTagNum: string;
  serviceName: string;
  equipSize?: number;
  requiredQty: number;
  itemLocation: string;
  manufacturerId: number;
  supplierId: number;
  installPackNum: string;
  modelNum: string;
  driver?: string;
  locationDWG?: string;
  pid?: number;
  installDWG?: string;
  codeStd?: string;
  categoryId: number;
  clientId: number;
  projectId: number;
};

export type Datasheet = {
  sheetName: string;
  SheetNameEng: string;
  sheetDesc: string;
  sheetDesc2?: string;
  clientName: string;
  clientLogo?: string;
  clientDoc?: number;
  clientProject?: number;
  companyDoc?: number;
  companyProject?: number;
  areaId: number;
  packageName: string;
  revisionNum: number;
  revisionDate: string;
  preparedBy: number;
  preparedDate: string;
  verifiedBy?: number;
  verifiedDate?: string;
  approvedBy?: number;
  approvedDate?: string;
};

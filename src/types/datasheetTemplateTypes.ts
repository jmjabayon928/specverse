// src/types/datasheetTemplateTypes.ts

export type DatasheetFormState = {
    sheetName: string;
    sheetDesc: string;
    sheetDesc2?: string;
    clientDoc?: string;
    clientProject?: string;
    companyDoc?: string;
    companyProject?: string;
    areaId: string;
    packageName: string;
    revisionNum: string;
    preparedBy: string;
    preparedDate: string;
    verifiedBy?: string;
    verifiedDate?: string;
    approvedBy?: string;
    approvedDate?: string;
  };
  
  export type EquipmentFormState = {
    requiredQty: string;
    itemLocation: string;
    manufacturerId: string;
    supplierId: string;
    installPackNum?: string;
    modelNum: string;
    driver?: string;
    locationDWG?: string;
    pid: string;
    installDWG?: string;
    codeStd?: string;
    categoryId: string;
    clientId: string;
    projectId: string;
    equipmentName: string;
    equipmentTagNum: string;
    serviceName: string;
    equipSize: string;
  };
  
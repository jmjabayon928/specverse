import { poolPromise, sql } from "../config/db";

export const fetchReferenceOptions = async () => {
  const pool = await poolPromise;

  const [areas, users, manufacturers, suppliers, categories, projects, clients] = await Promise.all([
    pool.query(`SELECT AreaID, AreaCode, AreaName FROM Areas`),
    pool.query(`SELECT UserID, FirstName, LastName FROM Users`),
    pool.query(`SELECT ManuID, ManuName FROM Manufacturers`),
    pool.query(`SELECT SuppID, SuppName FROM Suppliers`),
    pool.query(`SELECT CategoryID, CategoryName FROM Categories`),
    pool.query(`SELECT ProjectID, ProjName, ProjNum FROM Projects`),
    pool.query(`SELECT ClientID, ClientCode, ClientName FROM Clients`)
  ]);

  return {
    areas: areas.recordset,
    users: users.recordset,
    manufacturers: manufacturers.recordset,
    suppliers: suppliers.recordset,
    categories: categories.recordset,
    projects: projects.recordset,
    clients: clients.recordset,
  };
};

export const getTemplateDetailById = async (sheetId: number) => {
  const pool = await poolPromise;
  const request = pool.request();
  request.input("SheetID", sql.Int, sheetId);

  const result = await request.query(`
    SELECT
      s.SheetID,
      s.SheetName AS sheetName,
      s.SheetDesc AS sheetDesc,
      s.SheetDesc2 AS sheetDesc2,
      s.ClientDocNum AS clientDoc,
      s.ClientProjNum AS clientProject,
      s.CompanyDocNum AS companyDoc,
      s.CompanyProjNum AS companyProject,
      s.AreaID AS areaId,
      s.PackageName AS packageName,
      s.RevisionNum AS revisionNum,
      s.RevisionDate AS revisionDate,
      s.PreparedByID AS preparedBy,
      s.PreparedByDate AS preparedDate,
      s.VerifiedByID AS verifiedBy,
      s.VerifiedByDate AS verifiedDate,
      s.ApprovedByID AS approvedBy,
      s.ApprovedByDate AS approvedDate,
      c.ClientLogo AS clientLogo,
      s.Status AS status 
    FROM Sheets s
    LEFT JOIN Clients c ON s.ClientID = c.ClientID
    WHERE s.SheetID = @SheetID AND s.IsTemplate = 1
  `);

  return result.recordset[0];
};

export const getTemplateEquipmentById = async (sheetId: number) => {
  const pool = await poolPromise;
  const request = pool.request();
  request.input("SheetID", sql.Int, sheetId);

  const result = await request.query(`
    SELECT
      s.EquipmentName AS equipmentName,
      s.EquipmentTagNum AS equipmentTagNum,
      s.ServiceName AS serviceName,
      s.RequiredQty AS requiredQty,
      s.ItemLocation AS itemLocation,
      s.ManuID AS manufacturerId,
      s.SuppID AS supplierId,
      s.InstallPackNum AS installPackNum,
      s.EquipSize AS equipSize,
      s.ModelNum AS modelNum,
      s.Driver AS driver,
      s.LocationDwg AS locationDWG,
      s.PID AS pid,
      s.InstallDwg AS installDWG,
      s.CodeStd AS codeStd,
      s.CategoryID AS categoryId,
      s.ClientID AS clientId,
      s.ProjectID AS projectId,
      c.ClientLogo AS clientLogo 
    FROM Sheets s
    LEFT JOIN Clients c ON s.ClientID = c.ClientID
    WHERE s.SheetID = @SheetID
  `);

  return result.recordset[0];
};

export const getSubsheetTemplatesBySheetId = async (sheetId: number) => {
  const pool = await poolPromise;
  const request = pool.request();
  request.input("SheetID", sql.Int, sheetId);

  const subsheetResult = await request.query(`
    SELECT SubID, SubName AS name, OrderIndex
    FROM SubSheets
    WHERE SheetID = @SheetID
    ORDER BY OrderIndex
  `);

  const subsheets = subsheetResult.recordset;

  for (const subsheet of subsheets) {
    const templateRequest = pool.request();
    templateRequest.input("SubID", sql.Int, subsheet.SubID);

    const templateResult = await templateRequest.query(`
      SELECT InfoTemplateID, Label AS name, InfoType AS type, UOM, OrderIndex
      FROM InformationTemplates
      WHERE SubID = @SubID
      ORDER BY OrderIndex
    `);

    const templates = templateResult.recordset;

    for (const template of templates) {
      const optionRequest = pool.request();
      optionRequest.input("InfoTemplateID", sql.Int, template.InfoTemplateID);

      const optionResult = await optionRequest.query(`
        SELECT OptionValue
        FROM InformationTemplateOptions
        WHERE InfoTemplateID = @InfoTemplateID
        ORDER BY OptionValue
      `);

      template.options = optionResult.recordset.map((r) => r.OptionValue);
    }

    subsheet.templates = templates;
  }

  return subsheets;
};
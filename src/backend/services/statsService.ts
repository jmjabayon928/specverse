import { poolPromise } from "../config/db";

export const fetchDatasheetsByStatus = async (): Promise<{ status: string, total: number }[]> => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT Status AS status, COUNT(*) AS total
    FROM Sheets
    WHERE IsTemplate = 0
    GROUP BY Status
  `);
  return result.recordset;
};

export const fetchTemplatesCreatedOverTime = async (): Promise<{ month: string; total: number }[]> => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      FORMAT(PreparedByDate, 'yyyy-MM') AS month,
      COUNT(*) AS total
    FROM Sheets
    WHERE IsTemplate = 1
    GROUP BY FORMAT(PreparedByDate, 'yyyy-MM')
    ORDER BY month
  `);
  return result.recordset;
};

export async function getPendingVerifications() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      CASE 
        WHEN IsTemplate = 1 THEN 'Template'
        ELSE 'Filled Sheet'
      END AS Type,
      COUNT(*) AS Total
    FROM Sheets
    WHERE VerifiedByID IS NULL AND RejectedByID IS NULL
    GROUP BY IsTemplate
  `);
  return result.recordset;
}

export async function getActiveUsersByRole() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT r.RoleName, COUNT(*) AS Total
    FROM Users u
    JOIN Roles r ON u.RoleID = r.RoleID
    WHERE u.IsActive = 1
    GROUP BY r.RoleName
  `);
  return result.recordset;
}

export async function getInventoryStockLevels() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT CategoryName, SUM(QuantityOnHand) AS TotalStock
    FROM InventoryItems i
    JOIN Categories c ON i.CategoryID = c.CategoryID
    GROUP BY CategoryName
  `);
  return result.recordset;
}

export async function getEstimationTotalsByProject(): Promise<{ project: string; total: number }[]> {
  const pool = await poolPromise;

  const result = await pool.request().query(`
    SELECT 
      p.ProjName AS project,
      SUM(e.TotalLaborCost + e.TotalMaterialCost) AS total
    FROM Estimations e
    JOIN Projects p ON e.ProjectID = p.ProjectID
    GROUP BY p.ProjName
  `);

  return result.recordset;
}

export async function getDatasheetLifecycleStats() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      CASE WHEN IsTemplate = 1 THEN 'Template' ELSE 'Filled Sheet' END AS SheetType,
      AVG(DATEDIFF(DAY, PreparedByDate, ApprovedByDate)) AS AverageDays
    FROM Sheets
    WHERE ApprovedByDate IS NOT NULL
    GROUP BY IsTemplate
  `);

  return result.recordset;
}

export async function getVerificationBottlenecks() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      a.AreaName,
      AVG(DATEDIFF(DAY, s.PreparedByDate, s.VerifiedByDate)) AS AvgVerificationDays
    FROM Sheets s
    JOIN Areas a ON s.AreaID = a.AreaID
    WHERE s.VerifiedByDate IS NOT NULL
    GROUP BY a.AreaName
    ORDER BY AvgVerificationDays DESC
  `);

  return result.recordset;
}

export async function getTemplateUsageTrends() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      FORMAT(s.PreparedByDate, 'yyyy-MM') AS Month,
      t.SheetName AS TemplateName,
      COUNT(*) AS UsageCount
    FROM Sheets s
    JOIN Sheets t ON s.TemplateID = t.SheetID
    WHERE s.IsTemplate = 0 AND s.PreparedByDate IS NOT NULL
    GROUP BY FORMAT(s.PreparedByDate, 'yyyy-MM'), t.SheetName
    ORDER BY Month, TemplateName
  `);

  return result.recordset;
}

export async function getTeamPerformanceMetrics() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      u.FirstName + ' ' + u.LastName AS Engineer,
      COUNT(s.SheetID) AS TotalSheets,
      SUM(CASE WHEN s.RevisionDate IS NOT NULL AND s.PreparedByDate <= s.RevisionDate THEN 1 ELSE 0 END) * 100.0 / COUNT(s.SheetID) AS OnTimeRate,
      SUM(CASE WHEN s.VerifiedByID IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(s.SheetID) AS VerificationRate,
      SUM(CASE WHEN s.Status = 'Rejected' THEN 1 ELSE 0 END) * 100.0 / COUNT(s.SheetID) AS RejectionRate
    FROM Sheets s
    JOIN Users u ON s.PreparedByID = u.UserID
    WHERE s.IsTemplate = 1
    GROUP BY u.FirstName, u.LastName
    ORDER BY Engineer
  `);

  return result.recordset;
}

export async function getFieldCompletionTrends() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      it.Label AS FieldLabel,
      FORMAT(s.PreparedByDate, 'yyyy-MM') AS Month,
      COUNT(CASE WHEN iv.InfoValue IS NOT NULL AND LTRIM(RTRIM(iv.InfoValue)) <> '' THEN 1 END) * 100.0 / COUNT(*) AS CompletionRate
    FROM InformationValues iv
    JOIN Sheets s ON iv.SheetID = s.SheetID
    JOIN InformationTemplates it ON iv.InfoTemplateID = it.InfoTemplateID
    WHERE s.IsTemplate = 0
    GROUP BY it.Label, FORMAT(s.PreparedByDate, 'yyyy-MM')
    ORDER BY it.Label, Month
  `);
  return result.recordset;
}
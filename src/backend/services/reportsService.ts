// src/services/reportsService.ts
import { sql, poolPromise } from "../config/db";

export const getEstimationCostBreakdownFromDB = async () => {
  const pool = await poolPromise;

  const result = await pool.request().query(`
    SELECT 
      ISNULL(p.ProjName, 'Unknown Project') AS projectName,
      e.EstimationID,
      SUM(CASE WHEN qis.IsSelected = 1 THEN qis.QuotedUnitCost * ei.Quantity ELSE 0 END) AS vendor,
      ISNULL(e.TotalLaborCost, 0) AS labor
    FROM Estimations e
    LEFT JOIN EstimationItems ei ON e.EstimationID = ei.EstimationID
    LEFT JOIN EstimationItemSupplierQuotes qis 
      ON ei.ItemID = qis.ItemID AND qis.IsSelected = 1
    LEFT JOIN Projects p ON e.ProjectID = p.ProjectID
    GROUP BY e.EstimationID, p.ProjName, e.TotalLaborCost
    ORDER BY p.ProjName
  `);

  return result.recordset;
};

export const getVendorQuotesFromDB = async (estimationId: number) => {
  const pool = await poolPromise;

  const result = await pool.request()
    .input("EstimationID", sql.Int, estimationId)
    .query(`
      SELECT 
        ei.ItemID,
        i.ItemName,
        s.SuppName,
        qis.QuotedUnitCost,
        qis.ExpectedDeliveryDays,
        qis.IsSelected
      FROM EstimationItems ei
      JOIN InventoryItems i ON ei.ItemID = i.InventoryID
      JOIN EstimationItemSupplierQuotes qis ON ei.ItemID = qis.ItemID
      JOIN Suppliers s ON qis.SupplierID = s.SuppID
      WHERE ei.EstimationID = @EstimationID
      ORDER BY i.ItemName, s.SuppName
    `);

  return result.recordset;
};

export const getEstimateVsActualFromDB = async (estimationId: number) => {
  const pool = await poolPromise;

  const result = await pool.request()
    .input("EstimationID", sql.Int, estimationId)
    .query(`
      SELECT 
        i.ItemName,
        ei.Quantity,
        ei.EstimatedUnitCost,
        qis.QuotedUnitCost,
        (qis.QuotedUnitCost - ei.EstimatedUnitCost) AS CostDifference,
        ((qis.QuotedUnitCost - ei.EstimatedUnitCost) / NULLIF(ei.EstimatedUnitCost, 0)) * 100 AS VariancePercent
      FROM EstimationItems ei
      JOIN EstimationItemSupplierQuotes qis 
        ON ei.ItemID = qis.ItemID AND qis.IsSelected = 1
      JOIN InventoryItems i ON ei.ItemID = i.InventoryID
      WHERE ei.EstimationID = @EstimationID
    `);

  return result.recordset;
};

export async function getSupplierComparisonFromDB(estimationId: number | null) {
  const pool = await poolPromise;
  const request = pool.request();

  if (estimationId) {
    request.input("EstimationID", sql.Int, estimationId);
  }

  const result = await request.query(`
    SELECT 
      s.SuppName AS supplierName,
      es.TotalQuotedCost AS totalQuoted,
      COUNT(eis.QuoteID) AS itemCount,
      SUM(CASE WHEN eis.IsSelected = 1 THEN 1 ELSE 0 END) AS acceptedCount
    FROM EstimationSuppliers es
    JOIN Suppliers s ON s.SuppID = es.SupplierID
    LEFT JOIN EstimationItemSupplierQuotes eis ON eis.SupplierID = es.SupplierID
    ${estimationId ? "WHERE es.EstimationID = @EstimationID" : ""}
    GROUP BY s.SuppName, es.TotalQuotedCost
    ORDER BY totalQuoted DESC;
  `);

  return result.recordset;
}

export const getInventoryForecastFromDB = async () => {
  const pool = await poolPromise;

  const result = await pool.request().query(`
    SELECT 
      FORMAT(t.PerformedAt, 'yyyy-MM') AS month,
      i.ItemName AS itemName,
      SUM(t.QuantityChanged) AS totalQuantity
    FROM InventoryTransactions t
    JOIN InventoryItems i ON t.InventoryID = i.InventoryID
    WHERE t.PerformedAt IS NOT NULL
    GROUP BY FORMAT(t.PerformedAt, 'yyyy-MM'), i.ItemName
    ORDER BY month, itemName;
  `);

  return result.recordset;
};

export interface InventoryContributionItem {
  itemName: string;
  quantity: number;
}

export interface InventoryContributionCategory {
  categoryName: string;
  items: InventoryContributionItem[];
}

export async function getInventoryContributionFromDB(): Promise<InventoryContributionCategory[]> {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      c.CategoryName,
      i.ItemName,
      i.QuantityOnHand
    FROM InventoryItems i
    LEFT JOIN Categories c ON i.CategoryID = c.CategoryID
    WHERE i.IsActive = 1
    ORDER BY c.CategoryName, i.QuantityOnHand DESC
  `);

  const rows = Array.isArray(result.recordset) ? result.recordset : [];
  const grouped: Record<string, InventoryContributionItem[]> = {};

  for (const row of rows) {
    const category = row.CategoryName ?? 'Uncategorized';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push({
      itemName: String(row.ItemName ?? ''),
      quantity: Number(row.QuantityOnHand) || 0,
    });
  }

  return Object.entries(grouped).map(([categoryName, items]) => ({
    categoryName,
    items: Array.isArray(items) ? items : [],
  }));
}

export async function fetchRejectedTemplatesFromDB(): Promise<
  { month: string; rejectedCount: number }[]
> {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      FORMAT(RejectedByDate, 'yyyy-MM') AS month,
      COUNT(*) AS rejectedCount
    FROM Sheets
    WHERE IsTemplate = 1 AND Status = 'Rejected' AND RejectedByDate IS NOT NULL
    GROUP BY FORMAT(RejectedByDate, 'yyyy-MM')
    ORDER BY month
  `);

  return result.recordset;
}

export const getRejectedFilledSheetsOverTimeFromDB = async () => {
  const pool = await poolPromise;

  const result = await pool.request().query(`
    SELECT 
      FORMAT(s.RejectedByDate, 'yyyy-MM') AS Month,
      COUNT(*) AS RejectedCount
    FROM Sheets s
    WHERE s.IsTemplate = 0 AND s.Status = 'Rejected' AND s.RejectedByDate IS NOT NULL
    GROUP BY FORMAT(s.RejectedByDate, 'yyyy-MM')
    ORDER BY Month
  `);

  return result.recordset;
};

export async function getTemplateWorkflowSankeyData() {
  const pool = await poolPromise;

  const result = await pool.request().query(`
    SELECT 
      CASE 
        WHEN VerifiedByID IS NOT NULL AND ApprovedByID IS NOT NULL THEN 'Approved'
        WHEN VerifiedByID IS NOT NULL AND ApprovedByID IS NULL THEN 'Verified'
        WHEN RejectedByID IS NOT NULL THEN 'Rejected'
        ELSE 'Draft'
      END AS Status,
      COUNT(*) AS Count
    FROM Sheets
    WHERE IsTemplate = 1
    GROUP BY 
      CASE 
        WHEN VerifiedByID IS NOT NULL AND ApprovedByID IS NOT NULL THEN 'Approved'
        WHEN VerifiedByID IS NOT NULL AND ApprovedByID IS NULL THEN 'Verified'
        WHEN RejectedByID IS NOT NULL THEN 'Rejected'
        ELSE 'Draft'
      END
  `);

  // Simulated transitions for now (Draft always comes first)
  const rows = result.recordset;
  const nodeNames = ["Draft", "Verified", "Rejected", "Approved"];
  const nodes = nodeNames.map((name) => ({ name }));

  const links: { source: number; target: number; value: number }[] = [];

  const statusCount: Record<string, number> = {}
  for (const row of rows) {
    statusCount[row.Status] = row.Count
  }

  // Construct hypothetical transitions based on counts
  if (statusCount.Verified) {
    links.push({ source: 0, target: 1, value: statusCount.Verified });
  }
  if (statusCount.Approved) {
    links.push({ source: 1, target: 3, value: statusCount.Approved });
  }
  if (statusCount.Rejected) {
    links.push({ source: 0, target: 2, value: statusCount.Rejected });
  }
  if (statusCount.Draft && !statusCount.Verified && !statusCount.Rejected) {
    links.push({ source: 0, target: 0, value: statusCount.Draft }); // still Draft
  }

  return { nodes, links };
}

export async function getFilledSheetWorkflowSankeyFromDB() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT
      Status,
      COUNT(*) AS Count
    FROM Sheets
    WHERE IsTemplate = 0
    GROUP BY Status
  `);

  const statusOrder = ["Draft", "Verified", "Rejected", "Approved"];

  // Map status to node indices
  const nodeIndexMap: Record<string, number> = {};
  const nodes: { name: string; id: string }[] = [];

  for (const [index, status] of statusOrder.entries()) {
    nodeIndexMap[status] = index
    nodes.push({
      name: status,
      id: `${status}-${index}`
    })
  }

  const links: { source: number; target: number; value: number }[] = [];

  for (let i = 0; i < statusOrder.length - 1; i++) {
    const from = statusOrder[i];
    const to = statusOrder[i + 1];

    const toCount = result.recordset.find((r) => r.Status === to)?.Count || 0;

    // ✅ If at least some records moved into the 'to' status, simulate a flow
    if (toCount > 0) {
      links.push({
        source: nodeIndexMap[from],
        target: nodeIndexMap[to],
        value: toCount,
      });
    }
  }

  return { nodes, links };
}
// src/backend/database/ReferenceQueries.ts
import { poolPromise } from "@/backend/config/db";

/**
 * ✅ Centralized shared reference data query service
 * Used by ALL forms across SpecVerse
 */
export async function fetchReferenceOptions(accountId: number) {
  const pool = await poolPromise;

  const r = pool.request().input("AccountID", accountId);

  const [areasRes, usersRes, manufacturersRes, suppliersRes, categoriesRes, clientsRes, projectsRes, warehousesRes] =
    await Promise.all([
      r.query(`SELECT AreaID, AreaName FROM dbo.Areas WHERE AccountID = @AccountID ORDER BY AreaName`),
      r.query(`
        SELECT u.UserID, u.FirstName, u.LastName
        FROM dbo.Users u
        INNER JOIN dbo.AccountMembers am ON am.UserID = u.UserID
        WHERE am.AccountID = @AccountID AND am.IsActive = 1
        ORDER BY u.FirstName
      `),
      r.query(`SELECT ManuID, ManuName FROM dbo.Manufacturers WHERE AccountID = @AccountID ORDER BY ManuName`),
      r.query(`SELECT SuppID, SuppName FROM dbo.Suppliers WHERE AccountID = @AccountID ORDER BY SuppName`),
      r.query(`SELECT CategoryID, CategoryName FROM dbo.Categories ORDER BY CategoryName`),
      r.query(
        `SELECT ClientID, ClientCode, ClientName, ClientLogo FROM dbo.Clients WHERE AccountID = @AccountID ORDER BY ClientCode`,
      ),
      r.query(`SELECT ProjectID, ProjNum, ProjName FROM dbo.Projects WHERE AccountID = @AccountID ORDER BY ProjNum`),
      r.query(
        `SELECT WarehouseID, WarehouseName FROM dbo.Warehouses WHERE AccountID = @AccountID ORDER BY WarehouseName`,
      ),
    ]);

  return {
    areas: areasRes.recordset.map(row => ({
      id: Number(row.AreaID),
      name: row.AreaName
    })),
    users: usersRes.recordset.map(row => ({
      id: Number(row.UserID),
      name: `${row.FirstName} ${row.LastName}`
    })),
    manufacturers: manufacturersRes.recordset.map(row => ({
      id: Number(row.ManuID),
      name: row.ManuName
    })),
    suppliers: suppliersRes.recordset.map(row => ({
      id: Number(row.SuppID),
      name: row.SuppName
    })),
    categories: categoriesRes.recordset.map(row => ({
      id: Number(row.CategoryID),
      name: row.CategoryName
    })),
    clients: clientsRes.recordset.map(row => ({
      id: Number(row.ClientID),
      name: `${row.ClientCode} - ${row.ClientName}`,
      logo: row.ClientLogo
    })),
    projects: projectsRes.recordset.map(row => ({
      id: Number(row.ProjectID),
      name: `${row.ProjNum} - ${row.ProjName}`
    })),
    warehouses: warehousesRes.recordset.map(row => ({
      id: Number(row.WarehouseID),
      name: row.WarehouseName
    }))
  };
}

export async function getInventoryItemOptions(accountId: number) {
  const pool = await poolPromise;
  const result = await pool.request().input("AccountID", accountId).query(`
    SELECT 
      i.InventoryID AS ItemID,
      s.SheetName
    FROM Inventory i
    JOIN Sheets s ON i.SheetID = s.SheetID
    WHERE i.AccountID = @AccountID AND s.AccountID = @AccountID
    ORDER BY s.SheetName
  `);

  return result.recordset;
}
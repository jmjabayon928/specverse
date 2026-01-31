// src/backend/database/ReferenceQueries.ts
import { poolPromise } from "@/backend/config/db";

/**
 * ✅ Centralized shared reference data query service
 * Used by ALL forms across SpecVerse
 */
export async function fetchReferenceOptions() {
  const pool = await poolPromise;

  const [areasRes, usersRes, manufacturersRes, suppliersRes, categoriesRes, clientsRes, projectsRes, warehousesRes] = await Promise.all([
    pool.request().query(`SELECT AreaID, AreaName FROM Areas ORDER BY AreaName`),
    pool.request().query(`SELECT UserID, FirstName, LastName FROM Users ORDER BY FirstName`),
    pool.request().query(`SELECT ManuID, ManuName FROM Manufacturers ORDER BY ManuName`),
    pool.request().query(`SELECT SuppID, SuppName FROM Suppliers ORDER BY SuppName`),
    pool.request().query(`SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName`),
    pool.request().query(`SELECT ClientID, ClientCode, ClientName, ClientLogo FROM Clients ORDER BY ClientCode`),
    pool.request().query(`SELECT ProjectID, ProjNum, ProjName FROM Projects ORDER BY ProjNum`),
    pool.request().query(`SELECT WarehouseID, WarehouseName FROM Warehouses ORDER BY WarehouseName`)
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

export async function getInventoryItemOptions() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT 
      i.InventoryID AS ItemID,
      s.SheetName
    FROM Inventory i
    JOIN Sheets s ON i.SheetID = s.SheetID
    ORDER BY s.SheetName
  `);

  return result.recordset;
}
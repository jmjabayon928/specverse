// src/backend/database/ReferenceQueries.ts

import { poolPromise } from "@/backend/config/db";

/**
 * ✅ Centralized shared reference data query service
 * Used by ALL forms across SpecVerse
 */
export async function getAllReferenceOptions() {
  const pool = await poolPromise;

  const [areas, users, manufacturers, suppliers, categories, clients, projects] = await Promise.all([
    pool.request().query(`SELECT AreaID AS id, AreaName AS name FROM Areas ORDER BY AreaName`),
    pool.request().query(`SELECT UserID AS id, FirstName + ' ' + LastName AS name FROM Users ORDER BY FirstName`),
    pool.request().query(`SELECT ManuID AS id, ManuName AS name FROM Manufacturers ORDER BY ManuName`),
    pool.request().query(`SELECT SuppID AS id, SuppName AS name FROM Suppliers ORDER BY SuppName`),
    pool.request().query(`SELECT CategoryID AS id, CategoryNameEng AS name FROM Categories ORDER BY CategoryNameEng`),
    pool.request().query(`SELECT ClientID AS id, ClientCode + ' - ' + ClientName AS name FROM Clients ORDER BY ClientCode`),
    pool.request().query(`SELECT ProjID AS id, ProjNum + ' - ' + ProjName AS name FROM Projects ORDER BY ProjNum`)
  ]);

  return {
    areas: areas.recordset,
    users: users.recordset,
    manufacturers: manufacturers.recordset,
    suppliers: suppliers.recordset,
    categories: categories.recordset,
    clients: clients.recordset,
    projects: projects.recordset
  };
}

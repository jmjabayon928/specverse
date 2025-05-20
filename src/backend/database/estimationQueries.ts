import { poolPromise, sql } from "../config/db";

export async function getAllEstimations() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT * FROM Estimations ORDER BY CreatedAt DESC
  `);
  return result.recordset;
}

export async function getEstimationById(id: number) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EstimationID', sql.Int, id)
    .query(`
      SELECT 
        e.EstimationID,
        e.Title,
        e.Description,
        e.ClientID,
        c.ClientName,
        e.ProjectID,
        p.ProjName AS ProjectName,
        e.CurrencyCode,
        e.Status,
        e.CreatedBy,
        e.VerifiedBy,
        e.ApprovedBy,
        e.CreatedAt,
        e.VerifiedAt,
        e.ApprovedAt,
        u1.FirstName + ' ' + u1.LastName AS CreatedByName,
        u2.FirstName + ' ' + u2.LastName AS VerifiedByName,
        u3.FirstName + ' ' + u3.LastName AS ApprovedByName,
        (
          SELECT SUM(ep.TotalMaterialCost)
          FROM EstimationPackages ep
          WHERE ep.EstimationID = e.EstimationID
        ) AS TotalMaterialCost
      FROM Estimations e
      LEFT JOIN Clients c ON e.ClientID = c.ClientID
      LEFT JOIN Projects p ON e.ProjectID = p.ProjID
      LEFT JOIN Users u1 ON e.CreatedBy = u1.UserID
      LEFT JOIN Users u2 ON e.VerifiedBy = u2.UserID
      LEFT JOIN Users u3 ON e.ApprovedBy = u3.UserID
      WHERE e.EstimationID = @EstimationID
    `);
  return result.recordset[0];
}

export async function createEstimation(data: {
  ProjectID: number;
  Title: string;
  Description?: string;
  CreatedBy?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input("ProjectID", sql.Int, data.ProjectID)
    .input("Title", sql.NVarChar(255), data.Title)
    .input("Description", sql.NVarChar(sql.MAX), data.Description ?? null)
    .input("CreatedBy", sql.Int, data.CreatedBy ?? null)
    .query(`
      INSERT INTO Estimations (ProjectID, Title, Description, Status, CreatedAt, CreatedBy)
      OUTPUT INSERTED.*
      VALUES (@ProjectID, @Title, @Description, 'Draft', GETDATE(), @CreatedBy)
    `);
  return result.recordset[0];
}

export async function updateEstimation(estimationId: number, data: {
  Title: string;
  Description?: string;
  ProjectID?: number;
}) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('EstimationID', sql.Int, estimationId)
    .input('Title', sql.NVarChar(255), data.Title)
    .input('Description', sql.NVarChar(sql.MAX), data.Description ?? null)
    .input('ProjectID', sql.Int, data.ProjectID ?? null)
    .query(`
      UPDATE Estimations
      SET Title = @Title,
          Description = @Description,
          ProjectID = @ProjectID
      WHERE EstimationID = @EstimationID;

      SELECT * FROM Estimations WHERE EstimationID = @EstimationID;
    `);

  return result.recordset[0];
}

export async function getFilteredEstimations(
  statuses: string[] = [],
  clientIds: number[] = [],
  projectIds: number[] = [],
  search: string = ""
) {
  const pool = await poolPromise;
  const request = pool.request();

  request.input("search", sql.NVarChar, `%${search}%`);

  const statusFilter = statuses.length > 0 ? `AND e.Status IN (${statuses.map((s, i) => {
    const key = `status${i}`;
    request.input(key, sql.NVarChar, s);
    return `@${key}`;
  }).join(", ")})` : "";

  const clientFilter = clientIds.length > 0 ? `AND e.ClientID IN (${clientIds.map((id, i) => {
    const key = `client${i}`;
    request.input(key, sql.Int, id);
    return `@${key}`;
  }).join(", ")})` : "";

  const projectFilter = projectIds.length > 0 ? `AND e.ProjectID IN (${projectIds.map((id, i) => {
    const key = `proj${i}`;
    request.input(key, sql.Int, id);
    return `@${key}`;
  }).join(", ")})` : "";

  const result = await request.query(`
    SELECT 
      e.EstimationID,
      e.Title,
      e.Description,
      e.Status,
      e.ClientID,
      c.ClientName,
      e.ProjectID,
      p.ProjName AS ProjectName,
      e.CurrencyCode,
      e.CreatedBy,
      u1.FirstName + ' ' + u1.LastName AS CreatedByName,
      e.CreatedAt
    FROM Estimations e
    LEFT JOIN Clients c ON e.ClientID = c.ClientID
    LEFT JOIN Projects p ON e.ProjectID = p.ProjID
    LEFT JOIN Users u1 ON e.CreatedBy = u1.UserID
    WHERE 
      (e.Title LIKE @search OR e.Description LIKE @search)
      ${statusFilter}
      ${clientFilter}
      ${projectFilter}
    ORDER BY e.CreatedAt DESC
  `);

  return result.recordset;
}

export async function getFilteredEstimationsWithPagination(
  statuses: string[] = [],
  clientIds: number[] = [],
  projectIds: number[] = [],
  search: string = "",
  page: number = 1,
  pageSize: number = 10
) {
  const pool = await poolPromise;
  const request = pool.request();

  request.input("search", sql.NVarChar, `%${search}%`);
  request.input("offset", sql.Int, (page - 1) * pageSize);
  request.input("limit", sql.Int, pageSize);

  const statusFilter = statuses.length > 0 ? `AND e.Status IN (${statuses.map((s, i) => {
    const key = `status${i}`;
    request.input(key, sql.NVarChar, s);
    return `@${key}`;
  }).join(", ")})` : "";

  const clientFilter = clientIds.length > 0 ? `AND e.ClientID IN (${clientIds.map((id, i) => {
    const key = `client${i}`;
    request.input(key, sql.Int, id);
    return `@${key}`;
  }).join(", ")})` : "";

  const projectFilter = projectIds.length > 0 ? `AND e.ProjectID IN (${projectIds.map((id, i) => {
    const key = `proj${i}`;
    request.input(key, sql.Int, id);
    return `@${key}`;
  }).join(", ")})` : "";

  const result = await request.query(`
    SELECT 
      e.EstimationID,
      e.Title,
      e.Description,
      e.Status,
      e.ClientID,
      c.ClientName,
      e.ProjectID,
      p.ProjName AS ProjectName,
      e.CurrencyCode,
      e.CreatedBy,
      u1.FirstName + ' ' + u1.LastName AS CreatedByName,
      e.CreatedAt,
      COUNT(*) OVER() AS TotalCount
    FROM Estimations e
    LEFT JOIN Clients c ON e.ClientID = c.ClientID
    LEFT JOIN Projects p ON e.ProjectID = p.ProjID
    LEFT JOIN Users u1 ON e.CreatedBy = u1.UserID
    WHERE 
      (e.Title LIKE @search OR e.Description LIKE @search)
      ${statusFilter}
      ${clientFilter}
      ${projectFilter}
    ORDER BY e.CreatedAt DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `);

  return {
    estimations: result.recordset,
    totalCount: result.recordset.length > 0 ? result.recordset[0].TotalCount : 0,
  };
}


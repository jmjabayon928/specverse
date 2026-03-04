import { poolPromise, sql } from '../config/db'

export type CreateDeviationInput = {
  title: string
  description?: string | null
  projectId?: number | null
  clientId?: number | null
}

export type DeviationRow = {
  deviationId: number
  title: string
  description: string | null
  lifecycleStateId: number
  lifecycleCode: string
  projectId: number | null
  clientId: number | null
  createdAt: Date
  updatedAt: Date
  createdBy: number | null
  updatedBy: number | null
  accountId: number
}

export type ListDeviationsFilters = {
  page: number
  pageSize: number
  lifecycleStateId?: number | null
  projectId?: number | null
  clientId?: number | null
}

export type ListDeviationsResult = {
  rows: DeviationRow[]
  total: number
}

export async function createDeviation(
  accountId: number,
  userId: number,
  input: CreateDeviationInput,
  openLifecycleStateId: number
): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('Title', sql.NVarChar(255), input.title)
    .input('Description', sql.NVarChar(sql.MAX), input.description ?? null)
    .input('LifecycleStateID', sql.Int, openLifecycleStateId)
    .input('ProjectID', sql.Int, input.projectId ?? null)
    .input('ClientID', sql.Int, input.clientId ?? null)
    .input('CreatedBy', sql.Int, userId)
    .input('UpdatedBy', sql.Int, userId)
    .query<{ DeviationID: number }>(`
      INSERT INTO dbo.Deviations (Title, Description, LifecycleStateID, ProjectID, ClientID, CreatedBy, UpdatedBy, AccountID)
      OUTPUT INSERTED.DeviationID
      VALUES (@Title, @Description, @LifecycleStateID, @ProjectID, @ClientID, @CreatedBy, @UpdatedBy, @AccountID)
    `)
  return result.recordset[0].DeviationID
}

export async function getDeviationById(
  accountId: number,
  id: number
): Promise<DeviationRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('DeviationID', sql.Int, id)
    .query<{
      DeviationID: number
      Title: string
      Description: string | null
      LifecycleStateID: number
      Code: string
      ProjectID: number | null
      ClientID: number | null
      CreatedAt: Date
      UpdatedAt: Date
      CreatedBy: number | null
      UpdatedBy: number | null
      AccountID: number
    }>(`
      SELECT d.DeviationID, d.Title, d.Description, d.LifecycleStateID, ls.Code, d.ProjectID, d.ClientID,
             d.CreatedAt, d.UpdatedAt, d.CreatedBy, d.UpdatedBy, d.AccountID
      FROM dbo.Deviations d
      INNER JOIN dbo.LifecycleStates ls ON ls.LifecycleStateID = d.LifecycleStateID
      WHERE d.DeviationID = @DeviationID AND d.AccountID = @AccountID
    `)
  const row = result.recordset[0]
  if (!row) return null
  return {
    deviationId: row.DeviationID,
    title: row.Title,
    description: row.Description,
    lifecycleStateId: row.LifecycleStateID,
    lifecycleCode: row.Code,
    projectId: row.ProjectID,
    clientId: row.ClientID,
    createdAt: row.CreatedAt,
    updatedAt: row.UpdatedAt,
    createdBy: row.CreatedBy,
    updatedBy: row.UpdatedBy,
    accountId: row.AccountID,
  }
}

export async function listDeviations(
  accountId: number,
  filters: ListDeviationsFilters
): Promise<ListDeviationsResult> {
  const pool = await poolPromise
  const page = Math.max(1, filters.page)
  const pageSize = Math.min(Math.max(1, filters.pageSize), 100)
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['d.AccountID = @AccountID']
  const dataReq = pool.request()
  dataReq.input('AccountID', sql.Int, accountId)
  dataReq.input('Offset', sql.Int, offset)
  dataReq.input('PageSize', sql.Int, pageSize)

  if (filters.lifecycleStateId != null) {
    conditions.push('d.LifecycleStateID = @LifecycleStateID')
    dataReq.input('LifecycleStateID', sql.Int, filters.lifecycleStateId)
  }
  if (filters.projectId != null) {
    conditions.push('d.ProjectID = @ProjectID')
    dataReq.input('ProjectID', sql.Int, filters.projectId)
  }
  if (filters.clientId != null) {
    conditions.push('d.ClientID = @ClientID')
    dataReq.input('ClientID', sql.Int, filters.clientId)
  }

  const whereClause = conditions.join(' AND ')

  const dataResult = await dataReq.query<{
    DeviationID: number
    Title: string
    Description: string | null
    LifecycleStateID: number
    Code: string
    ProjectID: number | null
    ClientID: number | null
    CreatedAt: Date
    UpdatedAt: Date
    AccountID: number
  }>(`
    SELECT d.DeviationID, d.Title, d.Description, d.LifecycleStateID, ls.Code, d.ProjectID, d.ClientID,
           d.CreatedAt, d.UpdatedAt, d.AccountID
    FROM dbo.Deviations d
    INNER JOIN dbo.LifecycleStates ls ON ls.LifecycleStateID = d.LifecycleStateID
    WHERE ${whereClause}
    ORDER BY d.CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
  `)

  const countReq = pool.request()
  countReq.input('AccountID', sql.Int, accountId)
  if (filters.lifecycleStateId != null) countReq.input('LifecycleStateID', sql.Int, filters.lifecycleStateId)
  if (filters.projectId != null) countReq.input('ProjectID', sql.Int, filters.projectId)
  if (filters.clientId != null) countReq.input('ClientID', sql.Int, filters.clientId)
  const countResult = await countReq.query<{ Total: number }>(`
    SELECT COUNT(1) AS Total FROM dbo.Deviations d WHERE ${whereClause}
  `)
  const total = countResult.recordset[0]?.Total ?? 0

  const rows: DeviationRow[] = (dataResult.recordset ?? []).map(r => ({
    deviationId: r.DeviationID,
    title: r.Title,
    description: r.Description,
    lifecycleStateId: r.LifecycleStateID,
    lifecycleCode: r.Code,
    projectId: r.ProjectID,
    clientId: r.ClientID,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
    createdBy: null,
    updatedBy: null,
    accountId: r.AccountID,
  }))

  return { rows, total }
}

export type UpdateDeviationPatch = {
  title: string
  description: string | null
}

export async function updateDeviation(
  accountId: number,
  userId: number,
  id: number,
  patch: UpdateDeviationPatch
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('DeviationID', sql.Int, id)
    .input('Title', sql.NVarChar(255), patch.title)
    .input('Description', sql.NVarChar(sql.MAX), patch.description)
    .input('UpdatedBy', sql.Int, userId)
    .query<{ Affected: number }>(`
      UPDATE dbo.Deviations
      SET Title = @Title, Description = @Description, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
      WHERE DeviationID = @DeviationID AND AccountID = @AccountID;
      SELECT @@ROWCOUNT AS Affected;
    `)
  return (result.recordset[0]?.Affected ?? 0) > 0
}

export async function transitionDeviation(
  accountId: number,
  userId: number,
  id: number,
  fromLifecycleStateId: number,
  toLifecycleStateId: number,
  note?: string | null
): Promise<void> {
  const pool = await poolPromise
  const tx = new sql.Transaction(pool)
  try {
    await tx.begin()
    const req = new sql.Request(tx)
    req
      .input('DeviationID', sql.Int, id)
      .input('AccountID', sql.Int, accountId)
      .input('FromLifecycleStateID', sql.Int, fromLifecycleStateId)
      .input('ToLifecycleStateID', sql.Int, toLifecycleStateId)
      .input('Note', sql.NVarChar(1000), note ?? null)
      .input('ChangedBy', sql.Int, userId)
      .input('UpdatedBy', sql.Int, userId)
    await req.query(`
      INSERT INTO dbo.DeviationLifecycleHistory (DeviationID, FromLifecycleStateID, ToLifecycleStateID, Note, ChangedBy, AccountID)
      VALUES (@DeviationID, @FromLifecycleStateID, @ToLifecycleStateID, @Note, @ChangedBy, @AccountID);

      UPDATE dbo.Deviations
      SET LifecycleStateID = @ToLifecycleStateID, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
      WHERE DeviationID = @DeviationID AND AccountID = @AccountID;
    `)
    await tx.commit()
  } catch (err) {
    try {
      await tx.rollback()
    } catch {
      // ignore rollback errors
    }
    throw err
  }
}

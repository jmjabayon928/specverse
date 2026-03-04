import { poolPromise, sql } from '../config/db'

export type CreateSubmittalInput = {
  title: string
  description?: string | null
  projectId?: number | null
  clientId?: number | null
}

export type SubmittalRow = {
  submittalId: number
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

export type ListSubmittalsFilters = {
  page: number
  pageSize: number
  lifecycleStateId?: number | null
  projectId?: number | null
  clientId?: number | null
}

export type ListSubmittalsResult = {
  rows: SubmittalRow[]
  total: number
}

export async function createSubmittal(
  accountId: number,
  userId: number,
  input: CreateSubmittalInput,
  draftLifecycleStateId: number
): Promise<number> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('Title', sql.NVarChar(255), input.title)
    .input('Description', sql.NVarChar(sql.MAX), input.description ?? null)
    .input('LifecycleStateID', sql.Int, draftLifecycleStateId)
    .input('ProjectID', sql.Int, input.projectId ?? null)
    .input('ClientID', sql.Int, input.clientId ?? null)
    .input('CreatedBy', sql.Int, userId)
    .input('UpdatedBy', sql.Int, userId)
    .query<{ SubmittalID: number }>(`
      INSERT INTO dbo.Submittals (Title, Description, LifecycleStateID, ProjectID, ClientID, CreatedBy, UpdatedBy, AccountID)
      OUTPUT INSERTED.SubmittalID
      VALUES (@Title, @Description, @LifecycleStateID, @ProjectID, @ClientID, @CreatedBy, @UpdatedBy, @AccountID)
    `)
  return result.recordset[0].SubmittalID
}

export async function getSubmittalById(
  accountId: number,
  id: number
): Promise<SubmittalRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SubmittalID', sql.Int, id)
    .query<{
      SubmittalID: number
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
      SELECT s.SubmittalID, s.Title, s.Description, s.LifecycleStateID, ls.Code, s.ProjectID, s.ClientID,
             s.CreatedAt, s.UpdatedAt, s.CreatedBy, s.UpdatedBy, s.AccountID
      FROM dbo.Submittals s
      INNER JOIN dbo.LifecycleStates ls ON ls.LifecycleStateID = s.LifecycleStateID
      WHERE s.SubmittalID = @SubmittalID AND s.AccountID = @AccountID
    `)
  const row = result.recordset[0]
  if (!row) return null
  return {
    submittalId: row.SubmittalID,
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

export async function listSubmittals(
  accountId: number,
  filters: ListSubmittalsFilters
): Promise<ListSubmittalsResult> {
  const pool = await poolPromise
  const page = Math.max(1, filters.page)
  const pageSize = Math.min(Math.max(1, filters.pageSize), 100)
  const offset = (page - 1) * pageSize

  const conditions: string[] = ['s.AccountID = @AccountID']
  const dataReq = pool.request()
  dataReq.input('AccountID', sql.Int, accountId)
  dataReq.input('Offset', sql.Int, offset)
  dataReq.input('PageSize', sql.Int, pageSize)

  if (filters.lifecycleStateId != null) {
    conditions.push('s.LifecycleStateID = @LifecycleStateID')
    dataReq.input('LifecycleStateID', sql.Int, filters.lifecycleStateId)
  }
  if (filters.projectId != null) {
    conditions.push('s.ProjectID = @ProjectID')
    dataReq.input('ProjectID', sql.Int, filters.projectId)
  }
  if (filters.clientId != null) {
    conditions.push('s.ClientID = @ClientID')
    dataReq.input('ClientID', sql.Int, filters.clientId)
  }

  const whereClause = conditions.join(' AND ')

  const dataResult = await dataReq.query<{
    SubmittalID: number
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
    SELECT s.SubmittalID, s.Title, s.Description, s.LifecycleStateID, ls.Code, s.ProjectID, s.ClientID,
           s.CreatedAt, s.UpdatedAt, s.AccountID
    FROM dbo.Submittals s
    INNER JOIN dbo.LifecycleStates ls ON ls.LifecycleStateID = s.LifecycleStateID
    WHERE ${whereClause}
    ORDER BY s.CreatedAt DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY
  `)

  const countReq = pool.request()
  countReq.input('AccountID', sql.Int, accountId)
  if (filters.lifecycleStateId != null) countReq.input('LifecycleStateID', sql.Int, filters.lifecycleStateId)
  if (filters.projectId != null) countReq.input('ProjectID', sql.Int, filters.projectId)
  if (filters.clientId != null) countReq.input('ClientID', sql.Int, filters.clientId)
  const countResult = await countReq.query<{ Total: number }>(`
    SELECT COUNT(1) AS Total FROM dbo.Submittals s WHERE ${whereClause}
  `)
  const total = countResult.recordset[0]?.Total ?? 0

  const rows: SubmittalRow[] = (dataResult.recordset ?? []).map(r => ({
    submittalId: r.SubmittalID,
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

export type UpdateSubmittalPatch = {
  title: string
  description: string | null
}

export async function updateSubmittal(
  accountId: number,
  userId: number,
  id: number,
  patch: UpdateSubmittalPatch
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SubmittalID', sql.Int, id)
    .input('Title', sql.NVarChar(255), patch.title)
    .input('Description', sql.NVarChar(sql.MAX), patch.description)
    .input('UpdatedBy', sql.Int, userId)
    .query<{ Affected: number }>(`
      UPDATE dbo.Submittals
      SET Title = @Title, Description = @Description, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
      WHERE SubmittalID = @SubmittalID AND AccountID = @AccountID;
      SELECT @@ROWCOUNT AS Affected;
    `)
  return (result.recordset[0]?.Affected ?? 0) > 0
}

export async function transitionSubmittal(
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
      .input('SubmittalID', sql.Int, id)
      .input('AccountID', sql.Int, accountId)
      .input('FromLifecycleStateID', sql.Int, fromLifecycleStateId)
      .input('ToLifecycleStateID', sql.Int, toLifecycleStateId)
      .input('Note', sql.NVarChar(1000), note ?? null)
      .input('ChangedBy', sql.Int, userId)
      .input('UpdatedBy', sql.Int, userId)
    await req.query(`
      INSERT INTO dbo.SubmittalLifecycleHistory (SubmittalID, FromLifecycleStateID, ToLifecycleStateID, Note, ChangedBy, AccountID)
      VALUES (@SubmittalID, @FromLifecycleStateID, @ToLifecycleStateID, @Note, @ChangedBy, @AccountID);

      UPDATE dbo.Submittals
      SET LifecycleStateID = @ToLifecycleStateID, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UpdatedBy
      WHERE SubmittalID = @SubmittalID AND AccountID = @AccountID;
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

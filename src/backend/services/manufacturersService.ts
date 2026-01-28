// src/backend/services/manufacturersService.ts
import { poolPromise, sql } from '../config/db'

/** SQL row */
interface ManufacturerRowSQL {
  ManuID: number
  ManuName: string
  ManuAddress: string
  CreatedAt?: Date | string
  UpdatedAt?: Date | string
}

interface CountRow {
  Total: number
}

/** Public DTOs */
export interface ManufacturerDTO {
  ManuID: number
  ManuName: string
  ManuAddress: string
  CreatedAt?: string
  UpdatedAt?: string
}

export interface ListManufacturersParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListManufacturersResult {
  page: number
  pageSize: number
  total: number
  rows: ManufacturerDTO[]
}

export interface CreateManufacturerInput {
  ManuName: string
  ManuAddress: string
}

export interface UpdateManufacturerInput {
  ManuName?: string | null
  ManuAddress?: string | null
}

/** Helpers */

const toISO = (value?: Date | string): string | undefined => {
  if (value) {
    return new Date(value).toISOString()
  }

  return undefined
}

const mapRow = (row: ManufacturerRowSQL): ManufacturerDTO => ({
  ManuID: row.ManuID,
  ManuName: row.ManuName,
  ManuAddress: row.ManuAddress,
  CreatedAt: toISO(row.CreatedAt),
  UpdatedAt: toISO(row.UpdatedAt),
})

const isUniqueViolation = (error: unknown): boolean => {
  const candidate = error as { originalError?: { number?: number; message?: string } }
  const code = candidate.originalError?.number
  const message = candidate.originalError?.message ?? ''

  if (code === 2601 || code === 2627) {
    return true
  }

  if (message.includes('UX_Manufacturers_Name')) {
    return true
  }

  return false
}

const bindSearch = (request: sql.Request, search: string | undefined): { where: string } => {
  const query = (search ?? '').trim()

  if (query.length === 0) {
    return { where: '' }
  }

  request.input('q', sql.NVarChar(255), `%${query}%`)

  return {
    where: 'WHERE (m.ManuName LIKE @q OR m.ManuAddress LIKE @q)',
  }
}

/** List with paging + search */
export const listManufacturers = async (
  params: ListManufacturersParams,
): Promise<ListManufacturersResult> => {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize
  const search = params.search ?? ''

  const pool = await poolPromise

  // Data page
  const dataRequest = pool.request()
  dataRequest.input('Offset', sql.Int, offset)
  dataRequest.input('PageSize', sql.Int, pageSize)
  const { where } = bindSearch(dataRequest, search)

  const data = await dataRequest.query<ManufacturerRowSQL>(`
    SELECT
      m.ManuID,
      m.ManuName,
      m.ManuAddress,
      m.CreatedAt,
      m.UpdatedAt
    FROM dbo.Manufacturers m
    ${where}
    ORDER BY m.ManuID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = (data.recordset ?? []).map((row) => mapRow(row))

  // Count
  const countRequest = pool.request()
  bindSearch(countRequest, search)

  const count = await countRequest.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Manufacturers m
    ${where};
  `)

  const total = count.recordset[0]?.Total ?? 0

  return {
    page,
    pageSize,
    total,
    rows,
  }
}

/** Get single manufacturer by id, or null if not found */
export const getManufacturerById = async (id: number): Promise<ManufacturerDTO | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<ManufacturerRowSQL>(`
      SELECT
        m.ManuID,
        m.ManuName,
        m.ManuAddress,
        m.CreatedAt,
        m.UpdatedAt
      FROM dbo.Manufacturers m
      WHERE m.ManuID = @id;
    `)

  const row = result.recordset[0]

  if (!row) {
    return null
  }

  return mapRow(row)
}

/** Create — returns new ManuID */
export const createManufacturer = async (
  input: CreateManufacturerInput,
): Promise<number> => {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('ManuName', sql.VarChar(150), input.ManuName)
      .input('ManuAddress', sql.VarChar(255), input.ManuAddress)
      .query<{ ManuID: number }>(`
        INSERT INTO dbo.Manufacturers (
          ManuName,
          ManuAddress,
          CreatedAt,
          UpdatedAt
        )
        OUTPUT inserted.ManuID
        VALUES (
          @ManuName,
          @ManuAddress,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        );
      `)

    return result.recordset[0].ManuID
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('MANUNAME_CONFLICT')
      conflict.name = 'MANUNAME_CONFLICT'
      throw conflict
    }

    throw error
  }
}

/** Update — returns true if updated */
export const updateManufacturer = async (
  id: number,
  input: UpdateManufacturerInput,
): Promise<boolean> => {
  try {
    const pool = await poolPromise

    const sets: string[] = []
    const request = pool.request().input('id', sql.Int, id)

    if (Object.hasOwn(input, 'ManuName')) {
      sets.push('ManuName = @ManuName')
      request.input('ManuName', sql.VarChar(150), input.ManuName ?? null)
    }

    if (Object.hasOwn(input, 'ManuAddress')) {
      sets.push('ManuAddress = @ManuAddress')
      request.input('ManuAddress', sql.VarChar(255), input.ManuAddress ?? null)
    }

    if (sets.length === 0) {
      return true
    }

    sets.push('UpdatedAt = SYSUTCDATETIME()')

    const result = await request.query<{ Affected: number }>(`
      UPDATE dbo.Manufacturers
      SET ${sets.join(', ')}
      WHERE ManuID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

    const affected = result.recordset[0]?.Affected ?? 0

    return affected > 0
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('MANUNAME_CONFLICT')
      conflict.name = 'MANUNAME_CONFLICT'
      throw conflict
    }

    throw error
  }
}

/** Delete — returns true if a row was deleted */
export const deleteManufacturer = async (id: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Manufacturers
      WHERE ManuID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0

  return affected > 0
}

// src/backend/services/suppliersService.ts
import { poolPromise, sql } from '../config/db'

/** SQL row */
interface SupplierRowSQL {
  SuppID: number
  SuppName: string
  SuppAddress: string | null
  SuppCode: string | null
  SuppContact: string | null
  SuppEmail: string | null
  SuppPhone: string | null
  Notes: string | null
  CreatedAt?: Date | string
  UpdatedAt?: Date | string
}

interface CountRow {
  Total: number
}

/** Public DTOs */
export interface SupplierDTO {
  SuppID: number
  SuppName: string
  SuppAddress: string | null
  SuppCode: string | null
  SuppContact: string | null
  SuppEmail: string | null
  SuppPhone: string | null
  Notes: string | null
  CreatedAt?: string
  UpdatedAt?: string
}

export interface ListSuppliersParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListSuppliersResult {
  page: number
  pageSize: number
  total: number
  rows: SupplierDTO[]
}

export interface CreateSupplierInput {
  SuppName: string
  SuppAddress: string | null
  SuppCode: string | null
  SuppContact: string | null
  SuppEmail: string | null
  SuppPhone: string | null
  Notes: string | null
}

export interface UpdateSupplierInput {
  SuppName?: string
  SuppAddress?: string | null
  SuppCode?: string | null
  SuppContact?: string | null
  SuppEmail?: string | null
  SuppPhone?: string | null
  Notes?: string | null
}

/** Helpers */

const toISO = (value?: Date | string): string | undefined => {
  if (value) {
    return new Date(value).toISOString()
  }

  return undefined
}

const mapRow = (row: SupplierRowSQL): SupplierDTO => ({
  SuppID: row.SuppID,
  SuppName: row.SuppName,
  SuppAddress: row.SuppAddress,
  SuppCode: row.SuppCode,
  SuppContact: row.SuppContact,
  SuppEmail: row.SuppEmail,
  SuppPhone: row.SuppPhone,
  Notes: row.Notes,
  CreatedAt: toISO(row.CreatedAt),
  UpdatedAt: toISO(row.UpdatedAt),
})

const isUniqueViolation = (error: unknown): boolean => {
  const candidate = error as { originalError?: { number?: number; message?: string } }
  const code = candidate.originalError?.number
  const message = candidate.originalError?.message ?? ''

  // 2601 / 2627 = duplicate key
  if (code === 2601 || code === 2627) {
    return true
  }

  // Match your UX index name from the original implementation
  if (message.includes('UX_Suppliers_Code')) {
    return true
  }

  return false
}

const bindSearch = (request: sql.Request, search: string): { where: string } => {
  const query = search.trim()

  if (query.length === 0) {
    return { where: '' }
  }

  request.input('q', sql.NVarChar(255), `%${query}%`)

  return {
    where:
      'WHERE (s.SuppName LIKE @q OR s.SuppCode LIKE @q OR s.SuppAddress LIKE @q OR s.SuppContact LIKE @q OR s.SuppEmail LIKE @q OR s.SuppPhone LIKE @q)',
  }
}

/** List with paging + search */
export const listSuppliers = async (
  params: ListSuppliersParams,
): Promise<ListSuppliersResult> => {
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

  const data = await dataRequest.query<SupplierRowSQL>(`
    SELECT
      s.SuppID,
      s.SuppName,
      s.SuppAddress,
      s.SuppCode,
      s.SuppContact,
      s.SuppEmail,
      s.SuppPhone,
      s.Notes,
      s.CreatedAt,
      s.UpdatedAt
    FROM dbo.Suppliers s
    ${where}
    ORDER BY s.SuppID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = (data.recordset ?? []).map((row) => mapRow(row))

  // Count
  const countRequest = pool.request()
  bindSearch(countRequest, search)

  const count = await countRequest.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Suppliers s
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

/** Get by id */
export const getSupplierById = async (id: number): Promise<SupplierDTO | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<SupplierRowSQL>(`
      SELECT
        s.SuppID,
        s.SuppName,
        s.SuppAddress,
        s.SuppCode,
        s.SuppContact,
        s.SuppEmail,
        s.SuppPhone,
        s.Notes,
        s.CreatedAt,
        s.UpdatedAt
      FROM dbo.Suppliers s
      WHERE s.SuppID = @id;
    `)

  const row = result.recordset[0]

  if (!row) {
    return null
  }

  return mapRow(row)
}

/** Create — returns new SuppID */
export const createSupplier = async (
  input: CreateSupplierInput,
): Promise<number> => {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('SuppName', sql.NVarChar(255), input.SuppName)
      .input('SuppAddress', sql.NVarChar(sql.MAX), input.SuppAddress)
      .input('SuppCode', sql.NVarChar(50), input.SuppCode)
      .input('SuppContact', sql.NVarChar(255), input.SuppContact)
      .input('SuppEmail', sql.NVarChar(255), input.SuppEmail)
      .input('SuppPhone', sql.NVarChar(50), input.SuppPhone)
      .input('Notes', sql.NVarChar(sql.MAX), input.Notes)
      .query<{ SuppID: number }>(`
        INSERT INTO dbo.Suppliers (
          SuppName,
          SuppAddress,
          SuppCode,
          SuppContact,
          SuppEmail,
          SuppPhone,
          Notes
        )
        OUTPUT inserted.SuppID
        VALUES (
          @SuppName,
          @SuppAddress,
          @SuppCode,
          @SuppContact,
          @SuppEmail,
          @SuppPhone,
          @Notes
        );
      `)

    return result.recordset[0].SuppID
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('SUPPCODE_CONFLICT')
      conflict.name = 'SUPPCODE_CONFLICT'
      throw conflict
    }

    throw error
  }
}

/** Update — returns true if updated */
export const updateSupplier = async (
  id: number,
  input: UpdateSupplierInput,
): Promise<boolean> => {
  try {
    const pool = await poolPromise

    const sets: string[] = []
    const request = pool.request().input('id', sql.Int, id)

    if (Object.hasOwn(input, 'SuppName')) {
      sets.push('SuppName = @SuppName')
      request.input('SuppName', sql.NVarChar(255), input.SuppName ?? null)
    }

    if (Object.hasOwn(input, 'SuppAddress')) {
      sets.push('SuppAddress = @SuppAddress')
      request.input('SuppAddress', sql.NVarChar(sql.MAX), input.SuppAddress ?? null)
    }

    if (Object.hasOwn(input, 'SuppCode')) {
      sets.push('SuppCode = @SuppCode')
      request.input('SuppCode', sql.NVarChar(50), input.SuppCode ?? null)
    }

    if (Object.hasOwn(input, 'SuppContact')) {
      sets.push('SuppContact = @SuppContact')
      request.input('SuppContact', sql.NVarChar(255), input.SuppContact ?? null)
    }

    if (Object.hasOwn(input, 'SuppEmail')) {
      sets.push('SuppEmail = @SuppEmail')
      request.input('SuppEmail', sql.NVarChar(255), input.SuppEmail ?? null)
    }

    if (Object.hasOwn(input, 'SuppPhone')) {
      sets.push('SuppPhone = @SuppPhone')
      request.input('SuppPhone', sql.NVarChar(50), input.SuppPhone ?? null)
    }

    if (Object.hasOwn(input, 'Notes')) {
      sets.push('Notes = @Notes')
      request.input('Notes', sql.NVarChar(sql.MAX), input.Notes ?? null)
    }

    if (sets.length === 0) {
      return true
    }

    sets.push('UpdatedAt = SYSUTCDATETIME()')

    const result = await request.query<{ Affected: number }>(`
      UPDATE dbo.Suppliers
      SET ${sets.join(', ')}
      WHERE SuppID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

    const affected = result.recordset[0]?.Affected ?? 0

    return affected > 0
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('SUPPCODE_CONFLICT')
      conflict.name = 'SUPPCODE_CONFLICT'
      throw conflict
    }

    throw error
  }
}

/** Delete — returns true if a row was deleted */
export const deleteSupplier = async (id: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Suppliers
      WHERE SuppID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0

  return affected > 0
}

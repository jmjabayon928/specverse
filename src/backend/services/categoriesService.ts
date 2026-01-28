// src/backend/services/categoriesService.ts
import { poolPromise, sql } from '../config/db'

interface CategoryRowSQL {
  CategoryID: number
  CategoryCode: string
  CategoryName: string
  CreatedAt?: Date | string
  UpdatedAt?: Date | string
}

interface CountRow {
  Total: number
}

export interface CategoryDTO {
  CategoryID: number
  CategoryCode: string
  CategoryName: string
  CreatedAt?: string
  UpdatedAt?: string
}

export interface ListCategoriesParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListCategoriesResult {
  page: number
  pageSize: number
  total: number
  rows: CategoryDTO[]
}

export interface CreateCategoryInput {
  CategoryCode: string
  CategoryName: string
}

export interface UpdateCategoryInput {
  CategoryCode?: string
  CategoryName?: string
}

const toISO = (value?: Date | string): string | undefined => {
  if (value) {
    return new Date(value).toISOString()
  }

  return undefined
}

const mapRow = (row: CategoryRowSQL): CategoryDTO => ({
  CategoryID: row.CategoryID,
  CategoryCode: row.CategoryCode,
  CategoryName: row.CategoryName,
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

  if (message.includes('UX_Categories_Code')) {
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
    where: 'WHERE (c.CategoryCode LIKE @q OR c.CategoryName LIKE @q)',
  }
}

export const listCategories = async (
  params: ListCategoriesParams,
): Promise<ListCategoriesResult> => {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize
  const search = params.search ?? ''

  const pool = await poolPromise

  const dataRequest = pool.request()
  dataRequest.input('Offset', sql.Int, offset)
  dataRequest.input('PageSize', sql.Int, pageSize)
  const { where } = bindSearch(dataRequest, search)

  const data = await dataRequest.query<CategoryRowSQL>(`
    SELECT
      c.CategoryID,
      c.CategoryCode,
      c.CategoryName,
      c.CreatedAt,
      c.UpdatedAt
    FROM dbo.Categories c
    ${where}
    ORDER BY c.CategoryID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = (data.recordset ?? []).map((row) => mapRow(row))

  const countRequest = pool.request()
  bindSearch(countRequest, search)

  const count = await countRequest.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Categories c
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

export const getCategoryById = async (id: number): Promise<CategoryDTO | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<CategoryRowSQL>(`
      SELECT
        c.CategoryID,
        c.CategoryCode,
        c.CategoryName,
        c.CreatedAt,
        c.UpdatedAt
      FROM dbo.Categories c
      WHERE c.CategoryID = @id;
    `)

  const row = result.recordset[0]

  if (!row) {
    return null
  }

  return mapRow(row)
}

export const createCategory = async (input: CreateCategoryInput): Promise<number> => {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('CategoryCode', sql.VarChar(20), input.CategoryCode)
      .input('CategoryName', sql.VarChar(150), input.CategoryName)
      .query<{ CategoryID: number }>(`
        INSERT INTO dbo.Categories (
          CategoryCode,
          CategoryName,
          CreatedAt,
          UpdatedAt
        )
        OUTPUT inserted.CategoryID
        VALUES (
          @CategoryCode,
          @CategoryName,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        );
      `)

    return result.recordset[0].CategoryID
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('CATEGORYCODE_CONFLICT')
      conflict.name = 'CATEGORYCODE_CONFLICT'
      throw conflict
    }

    throw error
  }
}

export const updateCategory = async (
  id: number,
  input: UpdateCategoryInput,
): Promise<boolean> => {
  try {
    const pool = await poolPromise

    const sets: string[] = []
    const request = pool.request().input('id', sql.Int, id)

    if (Object.hasOwn(input, 'CategoryCode')) {
      sets.push('CategoryCode = @CategoryCode')
      request.input('CategoryCode', sql.VarChar(20), input.CategoryCode ?? null)
    }

    if (Object.hasOwn(input, 'CategoryName')) {
      sets.push('CategoryName = @CategoryName')
      request.input('CategoryName', sql.VarChar(150), input.CategoryName ?? null)
    }

    if (sets.length === 0) {
      return true
    }

    sets.push('UpdatedAt = SYSUTCDATETIME()')

    const result = await request.query<{ Affected: number }>(`
      UPDATE dbo.Categories
      SET ${sets.join(', ')}
      WHERE CategoryID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

    const affected = result.recordset[0]?.Affected ?? 0

    return affected > 0
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('CATEGORYCODE_CONFLICT')
      conflict.name = 'CATEGORYCODE_CONFLICT'
      throw conflict
    }

    throw error
  }
}

export const deleteCategory = async (id: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Categories
      WHERE CategoryID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0

  return affected > 0
}

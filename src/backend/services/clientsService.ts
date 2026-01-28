// src/backend/services/clientsService.ts
import { poolPromise, sql } from '../config/db'

interface ClientRowSQL {
  ClientID: number
  ClientCode: string
  ClientName: string
  ClientEmail: string
  ClientPhone: string
  ClientAddress: string
  ContactPerson: string
  ClientLogo: string
  CreatedAt?: Date | string
  UpdatedAt?: Date | string
}

interface CountRow {
  Total: number
}

export interface ClientDTO {
  ClientID: number
  ClientCode: string
  ClientName: string
  ClientEmail: string
  ClientPhone: string
  ClientAddress: string
  ContactPerson: string
  ClientLogo: string
  CreatedAt?: string
  UpdatedAt?: string
}

export interface ListClientsParams {
  page: number
  pageSize: number
  search?: string
}

export interface ListClientsResult {
  page: number
  pageSize: number
  total: number
  rows: ClientDTO[]
}

export interface CreateClientInput {
  ClientCode: string
  ClientName: string
  ClientEmail: string
  ClientPhone: string
  ClientAddress: string
  ContactPerson: string
  ClientLogo: string
}

export interface UpdateClientInput {
  ClientCode?: string | null
  ClientName?: string | null
  ClientEmail?: string | null
  ClientPhone?: string | null
  ClientAddress?: string | null
  ContactPerson?: string | null
  ClientLogo?: string | null
}

const toISO = (value?: Date | string): string | undefined => {
  if (value) {
    return new Date(value).toISOString()
  }

  return undefined
}

const mapRow = (row: ClientRowSQL): ClientDTO => ({
  ClientID: row.ClientID,
  ClientCode: row.ClientCode,
  ClientName: row.ClientName,
  ClientEmail: row.ClientEmail,
  ClientPhone: row.ClientPhone,
  ClientAddress: row.ClientAddress,
  ContactPerson: row.ContactPerson,
  ClientLogo: row.ClientLogo,
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

  if (message.includes('UX_Clients_Code')) {
    return true
  }

  return false
}

const bindSearch = (request: sql.Request, search: string | undefined): { where: string } => {
  const trimmed = (search ?? '').trim()

  if (trimmed.length === 0) {
    return { where: '' }
  }

  request.input('q', sql.NVarChar(255), `%${trimmed}%`)

  return {
    where:
      'WHERE (c.ClientName LIKE @q OR c.ClientCode LIKE @q OR c.ClientEmail LIKE @q OR c.ClientPhone LIKE @q)',
  }
}

export const listClients = async (params: ListClientsParams): Promise<ListClientsResult> => {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)
  const offset = (page - 1) * pageSize
  const search = params.search ?? ''

  const pool = await poolPromise

  const dataRequest = pool.request()
  dataRequest.input('Offset', sql.Int, offset)
  dataRequest.input('PageSize', sql.Int, pageSize)

  const { where } = bindSearch(dataRequest, search)

  const data = await dataRequest.query<ClientRowSQL>(`
    SELECT
      c.ClientID,
      c.ClientCode,
      c.ClientName,
      c.ClientEmail,
      c.ClientPhone,
      c.ClientAddress,
      c.ContactPerson,
      c.ClientLogo,
      c.CreatedAt,
      c.UpdatedAt
    FROM dbo.Clients c
    ${where}
    ORDER BY c.ClientID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `)

  const rows = data.recordset.map((row) => mapRow(row))

  const countRequest = pool.request()
  bindSearch(countRequest, search)

  const count = await countRequest.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Clients c
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

export const getClientById = async (id: number): Promise<ClientDTO | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<ClientRowSQL>(`
      SELECT
        c.ClientID,
        c.ClientCode,
        c.ClientName,
        c.ClientEmail,
        c.ClientPhone,
        c.ClientAddress,
        c.ContactPerson,
        c.ClientLogo,
        c.CreatedAt,
        c.UpdatedAt
      FROM dbo.Clients c
      WHERE c.ClientID = @id;
    `)

  const row = result.recordset[0]

  if (!row) {
    return null
  }

  return mapRow(row)
}

export const createClient = async (input: CreateClientInput): Promise<number> => {
  try {
    const pool = await poolPromise

    const result = await pool
      .request()
      .input('ClientCode', sql.VarChar(20), input.ClientCode)
      .input('ClientName', sql.VarChar(150), input.ClientName)
      .input('ClientEmail', sql.VarChar(150), input.ClientEmail)
      .input('ClientPhone', sql.VarChar(150), input.ClientPhone)
      .input('ClientAddress', sql.VarChar(150), input.ClientAddress)
      .input('ContactPerson', sql.VarChar(150), input.ContactPerson)
      .input('ClientLogo', sql.VarChar(150), input.ClientLogo)
      .query<{ ClientID: number }>(`
        INSERT INTO dbo.Clients (
          ClientCode,
          ClientName,
          ClientEmail,
          ClientPhone,
          ClientAddress,
          ContactPerson,
          ClientLogo,
          CreatedAt,
          UpdatedAt
        )
        OUTPUT inserted.ClientID
        VALUES (
          @ClientCode,
          @ClientName,
          @ClientEmail,
          @ClientPhone,
          @ClientAddress,
          @ContactPerson,
          @ClientLogo,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
        );
      `)

    return result.recordset[0].ClientID
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('CLIENTCODE_CONFLICT')
      conflict.name = 'CLIENTCODE_CONFLICT'
      throw conflict
    }

    throw error
  }
}

export const updateClient = async (
  id: number,
  input: UpdateClientInput,
): Promise<boolean> => {
  try {
    const pool = await poolPromise

    const sets: string[] = []
    const request = pool.request().input('id', sql.Int, id)

    if (Object.hasOwn(input, 'ClientCode')) {
      sets.push('ClientCode = @ClientCode')
      request.input('ClientCode', sql.VarChar(20), input.ClientCode ?? null)
    }

    if (Object.hasOwn(input, 'ClientName')) {
      sets.push('ClientName = @ClientName')
      request.input('ClientName', sql.VarChar(150), input.ClientName ?? null)
    }

    if (Object.hasOwn(input, 'ClientEmail')) {
      sets.push('ClientEmail = @ClientEmail')
      request.input('ClientEmail', sql.VarChar(150), input.ClientEmail ?? null)
    }

    if (Object.hasOwn(input, 'ClientPhone')) {
      sets.push('ClientPhone = @ClientPhone')
      request.input('ClientPhone', sql.VarChar(150), input.ClientPhone ?? null)
    }

    if (Object.hasOwn(input, 'ClientAddress')) {
      sets.push('ClientAddress = @ClientAddress')
      request.input('ClientAddress', sql.VarChar(150), input.ClientAddress ?? null)
    }

    if (Object.hasOwn(input, 'ContactPerson')) {
      sets.push('ContactPerson = @ContactPerson')
      request.input('ContactPerson', sql.VarChar(150), input.ContactPerson ?? null)
    }

    if (Object.hasOwn(input, 'ClientLogo')) {
      sets.push('ClientLogo = @ClientLogo')
      request.input('ClientLogo', sql.VarChar(150), input.ClientLogo ?? null)
    }

    if (sets.length === 0) {
      return true
    }

    sets.push('UpdatedAt = SYSUTCDATETIME()')

    const result = await request.query<{ Affected: number }>(`
      UPDATE dbo.Clients
      SET ${sets.join(', ')}
      WHERE ClientID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

    const affected = result.recordset[0]?.Affected ?? 0

    return affected > 0
  } catch (error) {
    if (isUniqueViolation(error)) {
      const conflict = new Error('CLIENTCODE_CONFLICT')
      conflict.name = 'CLIENTCODE_CONFLICT'
      throw conflict
    }

    throw error
  }
}

export const deleteClient = async (id: number): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Clients
      WHERE ClientID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `)

  const affected = result.recordset[0]?.Affected ?? 0

  return affected > 0
}

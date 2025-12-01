import { poolPromise, sql } from "../config/db";

/** SQL row */
interface ClientRowSQL {
  ClientID: number;
  ClientCode: string;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ClientAddress: string;
  ContactPerson: string;
  ClientLogo: string;
  CreatedAt?: Date | string;
  UpdatedAt?: Date | string;
}
interface CountRow { Total: number; }

/** Public DTOs */
export interface ClientDTO {
  ClientID: number;
  ClientCode: string;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ClientAddress: string;
  ContactPerson: string;
  ClientLogo: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ListClientsParams {
  page: number;
  pageSize: number;
  search?: string;
}
export interface ListClientsResult {
  page: number;
  pageSize: number;
  total: number;
  rows: ClientDTO[];
}

export interface CreateClientInput {
  ClientCode: string; ClientName: string; ClientEmail: string; ClientPhone: string;
  ClientAddress: string; ContactPerson: string; ClientLogo: string;
}
export interface UpdateClientInput {
  ClientCode?: string; ClientName?: string; ClientEmail?: string; ClientPhone?: string;
  ClientAddress?: string; ContactPerson?: string; ClientLogo?: string;
}

/** Helpers */
const toISO = (x?: Date | string) => (x ? new Date(x).toISOString() : undefined);
const mapRow = (r: ClientRowSQL): ClientDTO => ({
  ClientID: r.ClientID,
  ClientCode: r.ClientCode,
  ClientName: r.ClientName,
  ClientEmail: r.ClientEmail,
  ClientPhone: r.ClientPhone,
  ClientAddress: r.ClientAddress,
  ContactPerson: r.ContactPerson,
  ClientLogo: r.ClientLogo,
  CreatedAt: toISO(r.CreatedAt),
  UpdatedAt: toISO(r.UpdatedAt),
});

function isUniqueViolation(err: unknown): boolean {
  const e = err as { originalError?: { number?: number; message?: string } };
  const code = e?.originalError?.number;
  const msg = e?.originalError?.message ?? "";
  return code === 2601 || code === 2627 || msg.includes("UX_Clients_Code");
}

function bindSearch(request: sql.Request, search: string): { where: string } {
  const q = (search ?? "").trim();
  if (!q) return { where: "" };
  request.input("q", sql.NVarChar(255), `%${q}%`);
  return {
    where: `WHERE (c.ClientName LIKE @q OR c.ClientCode LIKE @q OR c.ClientEmail LIKE @q OR c.ClientPhone LIKE @q)`,
  };
}

/** List with paging + search */
export async function listClients(params: ListClientsParams): Promise<ListClientsResult> {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(Math.max(1, params.pageSize), 100);
  const offset = (page - 1) * pageSize;
  const search = params.search ?? "";

  const p = await poolPromise;

  // Data page
  const reqData = p.request();
  reqData.input("Offset", sql.Int, offset);
  reqData.input("PageSize", sql.Int, pageSize);
  const { where } = bindSearch(reqData, search);

  const data = await reqData.query<ClientRowSQL>(`
    SELECT c.ClientID, c.ClientCode, c.ClientName, c.ClientEmail, c.ClientPhone,
           c.ClientAddress, c.ContactPerson, c.ClientLogo, c.CreatedAt, c.UpdatedAt
    FROM dbo.Clients c
    ${where}
    ORDER BY c.ClientID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `);
  const rows = (data.recordset ?? []).map(mapRow);

  // Count
  const reqCount = p.request();
  bindSearch(reqCount, search);
  const count = await reqCount.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Clients c
    ${where};
  `);
  const total = count.recordset[0]?.Total ?? 0;

  return { page, pageSize, total, rows };
}

/** Get by id */
export async function getClientById(id: number): Promise<ClientDTO | null> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<ClientRowSQL>(`
      SELECT c.ClientID, c.ClientCode, c.ClientName, c.ClientEmail, c.ClientPhone,
             c.ClientAddress, c.ContactPerson, c.ClientLogo, c.CreatedAt, c.UpdatedAt
      FROM dbo.Clients c
      WHERE c.ClientID = @id;
    `);
  const row = r.recordset[0];
  return row ? mapRow(row) : null;
}

/** Create — returns new ClientID */
export async function createClient(input: CreateClientInput): Promise<number> {
  try {
    const p = await poolPromise;
    const r = await p.request()
      .input("ClientCode", sql.VarChar(20), input.ClientCode)
      .input("ClientName", sql.VarChar(150), input.ClientName)
      .input("ClientEmail", sql.VarChar(150), input.ClientEmail)
      .input("ClientPhone", sql.VarChar(150), input.ClientPhone)
      .input("ClientAddress", sql.VarChar(150), input.ClientAddress)
      .input("ContactPerson", sql.VarChar(150), input.ContactPerson)
      .input("ClientLogo", sql.VarChar(150), input.ClientLogo)
      .query<{ ClientID: number }>(`
        INSERT INTO dbo.Clients
          (ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson, ClientLogo)
        OUTPUT inserted.ClientID
        VALUES
          (@ClientCode, @ClientName, @ClientEmail, @ClientPhone, @ClientAddress, @ContactPerson, @ClientLogo);
      `);
    return r.recordset[0].ClientID;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("CLIENTCODE_CONFLICT");
      e.name = "CLIENTCODE_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Update — returns true if updated */
export async function updateClient(id: number, input: UpdateClientInput): Promise<boolean> {
  try {
    const p = await poolPromise;

    const sets: string[] = [];
    const req = p.request().input("id", sql.Int, id);

    if (input.ClientCode !== undefined) { sets.push("ClientCode = @ClientCode"); req.input("ClientCode", sql.VarChar(20), input.ClientCode ?? null); }
    if (input.ClientName !== undefined) { sets.push("ClientName = @ClientName"); req.input("ClientName", sql.VarChar(150), input.ClientName ?? null); }
    if (input.ClientEmail !== undefined) { sets.push("ClientEmail = @ClientEmail"); req.input("ClientEmail", sql.VarChar(150), input.ClientEmail ?? null); }
    if (input.ClientPhone !== undefined) { sets.push("ClientPhone = @ClientPhone"); req.input("ClientPhone", sql.VarChar(150), input.ClientPhone ?? null); }
    if (input.ClientAddress !== undefined) { sets.push("ClientAddress = @ClientAddress"); req.input("ClientAddress", sql.VarChar(150), input.ClientAddress ?? null); }
    if (input.ContactPerson !== undefined) { sets.push("ContactPerson = @ContactPerson"); req.input("ContactPerson", sql.VarChar(150), input.ContactPerson ?? null); }
    if (input.ClientLogo !== undefined) { sets.push("ClientLogo = @ClientLogo"); req.input("ClientLogo", sql.VarChar(150), input.ClientLogo ?? null); }

    if (sets.length === 0) return true;

    const r = await req.query<{ Affected: number }>(`
      UPDATE dbo.Clients
      SET ${sets.join(", ")}
      WHERE ClientID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `);
    return (r.recordset[0]?.Affected ?? 0) > 0;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("CLIENTCODE_CONFLICT");
      e.name = "CLIENTCODE_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Delete — returns true if a row was deleted */
export async function deleteClient(id: number): Promise<boolean> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Clients WHERE ClientID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `);
  return (r.recordset[0]?.Affected ?? 0) > 0;
}

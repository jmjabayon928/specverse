import { poolPromise, sql } from "../config/db";

/** SQL row */
interface SupplierRowSQL {
  SuppID: number;
  SuppName: string;
  SuppAddress: string | null;
  SuppCode: string | null;
  SuppContact: string | null;
  SuppEmail: string | null;
  SuppPhone: string | null;
  Notes: string | null;
  CreatedAt?: Date | string;
  UpdatedAt?: Date | string;
}
interface CountRow { Total: number; }

/** Public DTOs */
export interface SupplierDTO {
  SuppID: number;
  SuppName: string;
  SuppAddress: string | null;
  SuppCode: string | null;
  SuppContact: string | null;
  SuppEmail: string | null;
  SuppPhone: string | null;
  Notes: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ListSuppliersParams {
  page: number;
  pageSize: number;
  search?: string;
}
export interface ListSuppliersResult {
  page: number;
  pageSize: number;
  total: number;
  rows: SupplierDTO[];
}

export interface CreateSupplierInput {
  SuppName: string;
  SuppAddress: string | null;
  SuppCode: string | null;
  SuppContact: string | null;
  SuppEmail: string | null;
  SuppPhone: string | null;
  Notes: string | null;
}
export interface UpdateSupplierInput {
  SuppName?: string;
  SuppAddress?: string | null;
  SuppCode?: string | null;
  SuppContact?: string | null;
  SuppEmail?: string | null;
  SuppPhone?: string | null;
  Notes?: string | null;
}

/** Helpers */
const toISO = (x?: Date | string) => (x ? new Date(x).toISOString() : undefined);
const mapRow = (r: SupplierRowSQL): SupplierDTO => ({
  SuppID: r.SuppID,
  SuppName: r.SuppName,
  SuppAddress: r.SuppAddress,
  SuppCode: r.SuppCode,
  SuppContact: r.SuppContact,
  SuppEmail: r.SuppEmail,
  SuppPhone: r.SuppPhone,
  Notes: r.Notes,
  CreatedAt: toISO(r.CreatedAt),
  UpdatedAt: toISO(r.UpdatedAt),
});

function isUniqueViolation(err: unknown): boolean {
  const e = err as { originalError?: { number?: number; message?: string } };
  const code = e?.originalError?.number;
  const msg = e?.originalError?.message ?? "";
  // 2601/2627 duplicate key; adjust to your actual unique index name if you add one
  return code === 2601 || code === 2627 || msg.includes("UX_Suppliers_Code");
}

function bindSearch(request: sql.Request, search: string): { where: string } {
  const q = (search ?? "").trim();
  if (!q) return { where: "" };
  request.input("q", sql.NVarChar(255), `%${q}%`);
  return {
    where: `WHERE (s.SuppName LIKE @q OR s.SuppCode LIKE @q OR s.SuppContact LIKE @q OR s.SuppEmail LIKE @q OR s.SuppPhone LIKE @q)`,
  };
}

/** List with paging + search */
export async function listSuppliers(params: ListSuppliersParams): Promise<ListSuppliersResult> {
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

  const data = await reqData.query<SupplierRowSQL>(`
    SELECT s.SuppID, s.SuppName, s.SuppAddress, s.SuppCode, s.SuppContact,
           s.SuppEmail, s.SuppPhone, s.Notes, s.CreatedAt, s.UpdatedAt
    FROM dbo.Suppliers s
    ${where}
    ORDER BY s.SuppID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `);
  const rows = (data.recordset ?? []).map(mapRow);

  // Count
  const reqCount = p.request();
  bindSearch(reqCount, search);
  const count = await reqCount.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Suppliers s
    ${where};
  `);
  const total = count.recordset[0]?.Total ?? 0;

  return { page, pageSize, total, rows };
}

/** Get by id */
export async function getSupplierById(id: number): Promise<SupplierDTO | null> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<SupplierRowSQL>(`
      SELECT s.SuppID, s.SuppName, s.SuppAddress, s.SuppCode, s.SuppContact,
             s.SuppEmail, s.SuppPhone, s.Notes, s.CreatedAt, s.UpdatedAt
      FROM dbo.Suppliers s
      WHERE s.SuppID = @id;
    `);
  const row = r.recordset[0];
  return row ? mapRow(row) : null;
}

/** Create — returns new SuppID */
export async function createSupplier(input: CreateSupplierInput): Promise<number> {
  try {
    const p = await poolPromise;
    const r = await p.request()
      .input("SuppName", sql.NVarChar(255), input.SuppName)
      .input("SuppAddress", sql.NVarChar(sql.MAX), input.SuppAddress)
      .input("SuppCode", sql.NVarChar(50), input.SuppCode)
      .input("SuppContact", sql.NVarChar(255), input.SuppContact)
      .input("SuppEmail", sql.NVarChar(255), input.SuppEmail)
      .input("SuppPhone", sql.NVarChar(50), input.SuppPhone)
      .input("Notes", sql.NVarChar(sql.MAX), input.Notes)
      .query<{ SuppID: number }>(`
        INSERT INTO dbo.Suppliers
          (SuppName, SuppAddress, SuppCode, SuppContact, SuppEmail, SuppPhone, Notes)
        OUTPUT inserted.SuppID
        VALUES
          (@SuppName, @SuppAddress, @SuppCode, @SuppContact, @SuppEmail, @SuppPhone, @Notes);
      `);
    return r.recordset[0].SuppID;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("SUPPCODE_CONFLICT");
      e.name = "SUPPCODE_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Update — returns true if updated */
export async function updateSupplier(id: number, input: UpdateSupplierInput): Promise<boolean> {
  try {
    const p = await poolPromise;

    const sets: string[] = [];
    const req = p.request().input("id", sql.Int, id);

    if (input.SuppName !== undefined) { sets.push("SuppName = @SuppName"); req.input("SuppName", sql.NVarChar(255), input.SuppName ?? null); }
    if (input.SuppAddress !== undefined) { sets.push("SuppAddress = @SuppAddress"); req.input("SuppAddress", sql.NVarChar(sql.MAX), input.SuppAddress); }
    if (input.SuppCode !== undefined) { sets.push("SuppCode = @SuppCode"); req.input("SuppCode", sql.NVarChar(50), input.SuppCode); }
    if (input.SuppContact !== undefined) { sets.push("SuppContact = @SuppContact"); req.input("SuppContact", sql.NVarChar(255), input.SuppContact); }
    if (input.SuppEmail !== undefined) { sets.push("SuppEmail = @SuppEmail"); req.input("SuppEmail", sql.NVarChar(255), input.SuppEmail); }
    if (input.SuppPhone !== undefined) { sets.push("SuppPhone = @SuppPhone"); req.input("SuppPhone", sql.NVarChar(50), input.SuppPhone); }
    if (input.Notes !== undefined) { sets.push("Notes = @Notes"); req.input("Notes", sql.NVarChar(sql.MAX), input.Notes); }

    if (sets.length === 0) return true;

    const r = await req.query<{ Affected: number }>(`
      UPDATE dbo.Suppliers
      SET ${sets.join(", ")}
      WHERE SuppID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `);
    return (r.recordset[0]?.Affected ?? 0) > 0;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("SUPPCODE_CONFLICT");
      e.name = "SUPPCODE_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Delete — returns true if a row was deleted */
export async function deleteSupplier(id: number): Promise<boolean> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Suppliers WHERE SuppID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `);
  return (r.recordset[0]?.Affected ?? 0) > 0;
}

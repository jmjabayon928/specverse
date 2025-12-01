import { poolPromise, sql } from "../config/db";

/** SQL row */
interface ManufacturerRowSQL {
  ManuID: number;
  ManuName: string;
  ManuAddress: string;
  CreatedAt?: Date | string;
  UpdatedAt?: Date | string;
}
interface CountRow { Total: number; }

/** Public DTOs */
export interface ManufacturerDTO {
  ManuID: number;
  ManuName: string;
  ManuAddress: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ListManufacturersParams {
  page: number;
  pageSize: number;
  search?: string;
}
export interface ListManufacturersResult {
  page: number;
  pageSize: number;
  total: number;
  rows: ManufacturerDTO[];
}

export interface CreateManufacturerInput { ManuName: string; ManuAddress: string; }
export interface UpdateManufacturerInput { ManuName?: string; ManuAddress?: string; }

/** Helpers */
const toISO = (x?: Date | string) => (x ? new Date(x).toISOString() : undefined);
const mapRow = (r: ManufacturerRowSQL): ManufacturerDTO => ({
  ManuID: r.ManuID,
  ManuName: r.ManuName,
  ManuAddress: r.ManuAddress,
  CreatedAt: toISO(r.CreatedAt),
  UpdatedAt: toISO(r.UpdatedAt),
});

function isUniqueViolation(err: unknown): boolean {
  const e = err as { originalError?: { number?: number; message?: string } };
  const code = e?.originalError?.number;
  const msg = e?.originalError?.message ?? "";
  // 2601/2627 duplicate key; adjust "UX_Manufacturers_Name" if you created a unique index on ManuName
  return code === 2601 || code === 2627 || msg.includes("UX_Manufacturers_Name");
}

function bindSearch(request: sql.Request, search: string): { where: string } {
  const q = (search ?? "").trim();
  if (!q) return { where: "" };
  request.input("q", sql.NVarChar(255), `%${q}%`);
  return {
    where: `WHERE (m.ManuName LIKE @q OR m.ManuAddress LIKE @q)`,
  };
}

/** List with paging + search */
export async function listManufacturers(params: ListManufacturersParams): Promise<ListManufacturersResult> {
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

  const data = await reqData.query<ManufacturerRowSQL>(`
    SELECT m.ManuID, m.ManuName, m.ManuAddress, m.CreatedAt, m.UpdatedAt
    FROM dbo.Manufacturers m
    ${where}
    ORDER BY m.ManuID DESC
    OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
  `);
  const rows = (data.recordset ?? []).map(mapRow);

  // Count
  const reqCount = p.request();
  bindSearch(reqCount, search);
  const count = await reqCount.query<CountRow>(`
    SELECT COUNT(1) AS Total
    FROM dbo.Manufacturers m
    ${where};
  `);
  const total = count.recordset[0]?.Total ?? 0;

  return { page, pageSize, total, rows };
}

/** Get by id */
export async function getManufacturerById(id: number): Promise<ManufacturerDTO | null> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<ManufacturerRowSQL>(`
      SELECT m.ManuID, m.ManuName, m.ManuAddress, m.CreatedAt, m.UpdatedAt
      FROM dbo.Manufacturers m
      WHERE m.ManuID = @id;
    `);
  const row = r.recordset[0];
  return row ? mapRow(row) : null;
}

/** Create — returns new ManuID */
export async function createManufacturer(input: CreateManufacturerInput): Promise<number> {
  try {
    const p = await poolPromise;
    const r = await p.request()
      .input("ManuName", sql.VarChar(150), input.ManuName)
      .input("ManuAddress", sql.VarChar(255), input.ManuAddress)
      .query<{ ManuID: number }>(`
        INSERT INTO dbo.Manufacturers (ManuName, ManuAddress)
        OUTPUT inserted.ManuID
        VALUES (@ManuName, @ManuAddress);
      `);
    return r.recordset[0].ManuID;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("MANUNAME_CONFLICT");
      e.name = "MANUNAME_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Update — returns true if updated */
export async function updateManufacturer(id: number, input: UpdateManufacturerInput): Promise<boolean> {
  try {
    const p = await poolPromise;

    const sets: string[] = [];
    const req = p.request().input("id", sql.Int, id);

    if (input.ManuName !== undefined) { sets.push("ManuName = @ManuName"); req.input("ManuName", sql.VarChar(150), input.ManuName ?? null); }
    if (input.ManuAddress !== undefined) { sets.push("ManuAddress = @ManuAddress"); req.input("ManuAddress", sql.VarChar(255), input.ManuAddress ?? null); }

    if (sets.length === 0) return true;

    const r = await req.query<{ Affected: number }>(`
      UPDATE dbo.Manufacturers
      SET ${sets.join(", ")}
      WHERE ManuID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `);
    return (r.recordset[0]?.Affected ?? 0) > 0;
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      const e = new Error("MANUNAME_CONFLICT");
      e.name = "MANUNAME_CONFLICT";
      throw e;
    }
    throw err;
  }
}

/** Delete — returns true if a row was deleted */
export async function deleteManufacturer(id: number): Promise<boolean> {
  const p = await poolPromise;
  const r = await p.request()
    .input("id", sql.Int, id)
    .query<{ Affected: number }>(`
      DELETE FROM dbo.Manufacturers WHERE ManuID = @id;
      SELECT @@ROWCOUNT AS Affected;
    `);
  return (r.recordset[0]?.Affected ?? 0) > 0;
}

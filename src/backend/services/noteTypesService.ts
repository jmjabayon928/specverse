import { poolPromise } from "@/backend/config/db";

export type NoteTypeRow = {
  NoteTypeID: number;
  NoteType: string;
  Description: string | null;
};

export async function getNoteTypes(): Promise<NoteTypeRow[]> {
  const pool = await poolPromise;
  const r = await pool.request().query<NoteTypeRow>(`
    SELECT NoteTypeID, NoteType, Description
    FROM dbo.NoteTypes
    ORDER BY NoteType
  `);
  return r.recordset ?? [];
}

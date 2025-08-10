// src/backend/services/sheetNotesService.ts
import { poolPromise, sql } from "@/backend/config/db";
import { HttpError } from "@/utils/errors";
import type { SheetNoteDTO } from "@/types/sheetNotes";

async function assertSheetEditable(sheetId: number) {
  const pool = await poolPromise;
  const r = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`SELECT Status FROM dbo.Sheets WHERE SheetID = @SheetID`);

  if (!r.recordset?.length) {
    throw new HttpError(404, "Sheet not found.");
  }

  const raw = r.recordset[0].Status as string | null;
  const status = (raw ?? "").toUpperCase();
  if (status === "VERIFIED" || status === "APPROVED") {
    throw new HttpError(409, "Sheet is locked (Verified/Approved); notes cannot be changed.");
  }
}

export async function getSheetNotes(sheetId: number): Promise<SheetNoteDTO[]> {
  if (!Number.isFinite(sheetId) || sheetId <= 0) return [];
  const pool = await poolPromise;
  const result = await pool.request()
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT n.NoteID, n.SheetID, n.NoteTypeID, nt.NoteType, n.NoteText, n.OrderIndex,
             n.CreatedAt, n.UpdatedAt
      FROM dbo.SheetNotes n
      JOIN dbo.NoteTypes nt ON nt.NoteTypeID = n.NoteTypeID
      WHERE n.SheetID = @SheetID
      ORDER BY nt.NoteType, n.OrderIndex, n.NoteID
    `);
  return result.recordset as SheetNoteDTO[];
}

/* ---------- Create ---------- */

export type CreateNoteInput = {
  sheetId: number;
  noteTypeId: number;
  noteText: string;
  orderIndex?: number;
  createdBy?: number | null;
};

export async function createNote(input: CreateNoteInput): Promise<SheetNoteDTO> {
  const { sheetId, noteTypeId, noteText, orderIndex, createdBy = null } = input;
  await assertSheetEditable(sheetId);

  if (!Number.isFinite(sheetId) || sheetId <= 0) throw new HttpError(400, "Invalid sheetId");
  if (!Number.isFinite(noteTypeId) || noteTypeId <= 0) throw new HttpError(400, "Invalid noteTypeId");

  const cleanText = typeof noteText === "string" ? noteText.trim() : "";
  if (!cleanText) throw new HttpError(400, "NoteText is required");

  const hasOrder = typeof orderIndex === "number" && Number.isFinite(orderIndex);

  const pool = await poolPromise;
  try {
    const ins = await pool.request()
      .input("SheetID", sql.Int, sheetId)
      .input("NoteTypeID", sql.Int, noteTypeId)
      .input("NoteText", sql.NVarChar(sql.MAX), cleanText)
      .input("OrderIndex", sql.Int, hasOrder ? orderIndex! : null)
      .input("CreatedBy", sql.Int, createdBy)
      .query(`
        INSERT INTO dbo.SheetNotes (SheetID, NoteTypeID, NoteText, OrderIndex, CreatedBy)
        VALUES (
          @SheetID,
          @NoteTypeID,
          @NoteText,
          COALESCE(@OrderIndex,
            (SELECT ISNULL(MAX(n.OrderIndex), -1) + 1
             FROM dbo.SheetNotes n WITH (UPDLOCK, HOLDLOCK)
             WHERE n.SheetID = @SheetID)
          ),
          @CreatedBy
        );

        SELECT CAST(SCOPE_IDENTITY() AS INT) AS NewID;
      `);

    const newId: number | undefined = ins.recordset?.[0]?.NewID;
    if (!Number.isFinite(newId)) throw new HttpError(500, "Failed to create note");

    const sel = await pool.request()
      .input("NoteID", sql.Int, newId!)
      .query(`
        SELECT n.NoteID, n.SheetID, n.NoteTypeID, nt.NoteType, n.NoteText, n.OrderIndex,
               n.CreatedAt, n.UpdatedAt
        FROM dbo.SheetNotes n
        JOIN dbo.NoteTypes nt ON nt.NoteTypeID = n.NoteTypeID
        WHERE n.NoteID = @NoteID
      `);

    return sel.recordset[0] as SheetNoteDTO;
  } catch (e: unknown) {
    // Optional: nicer FK error for bad NoteTypeID
    const mssqlErr = e as { number?: number };
    if (mssqlErr?.number === 547) {
      throw new HttpError(400, "Invalid NoteTypeID (foreign key).");
    }
    throw e;
  }
}

/* ---------- Update ---------- */

export type UpdateNoteInput = {
  noteId: number;
  sheetId: number;
  noteTypeId?: number;
  noteText?: string;
  orderIndex?: number;
  updatedBy?: number | null;
};

export async function updateNote(input: UpdateNoteInput): Promise<SheetNoteDTO> {
  const { noteId, sheetId, noteTypeId, noteText, orderIndex, updatedBy = null } = input;
  await assertSheetEditable(sheetId);

  if (!Number.isFinite(sheetId) || sheetId <= 0) throw new HttpError(400, "Invalid sheetId");
  if (!Number.isFinite(noteId) || noteId <= 0) throw new HttpError(400, "Invalid noteId");

  const hasType   = typeof noteTypeId === "number" && Number.isFinite(noteTypeId);
  const hasText   = typeof noteText === "string";
  const hasOrder  = typeof orderIndex === "number" && Number.isFinite(orderIndex);

  if (!hasType && !hasText && !hasOrder) {
    throw new HttpError(400, "No fields to update");
  }

  const cleanText = hasText ? noteText!.trim() : null;

  const pool = await poolPromise;
  const upd = await pool.request()
    .input("NoteID", sql.Int, noteId)
    .input("SheetID", sql.Int, sheetId)
    .input("NoteTypeID", sql.Int, hasType ? noteTypeId! : null)
    .input("NoteText", sql.NVarChar(sql.MAX), hasText ? cleanText : null)
    .input("OrderIndex", sql.Int, hasOrder ? orderIndex! : null)
    .input("UpdatedBy", sql.Int, updatedBy)
    .query(`
      UPDATE n SET
        NoteTypeID = COALESCE(@NoteTypeID, n.NoteTypeID),
        NoteText   = COALESCE(@NoteText,   n.NoteText),
        OrderIndex = COALESCE(@OrderIndex, n.OrderIndex),
        UpdatedBy  = @UpdatedBy,
        UpdatedAt  = SYSUTCDATETIME()
      FROM dbo.SheetNotes n
      WHERE n.NoteID = @NoteID AND n.SheetID = @SheetID;

      SELECT @@ROWCOUNT AS Affected;
    `);

  const affected: number = upd.recordset?.[0]?.Affected ?? 0;
  if (affected === 0) throw new HttpError(404, "Note not found");

  const sel = await pool.request()
    .input("NoteID", sql.Int, noteId)
    .input("SheetID", sql.Int, sheetId)
    .query(`
      SELECT n.NoteID, n.SheetID, n.NoteTypeID, nt.NoteType, n.NoteText, n.OrderIndex,
             n.CreatedAt, n.UpdatedAt
      FROM dbo.SheetNotes n
      JOIN dbo.NoteTypes nt ON nt.NoteTypeID = n.NoteTypeID
      WHERE n.NoteID = @NoteID AND n.SheetID = @SheetID
    `);

  if (!sel.recordset?.length) throw new HttpError(404, "Note not found after update");
  return sel.recordset[0] as SheetNoteDTO;
}

/* ---------- Delete ---------- */

export type DeleteNoteInput = {
  noteId: number;
  sheetId: number;
};

export async function deleteNoteById(input: DeleteNoteInput): Promise<void> {
  const { noteId, sheetId } = input;
  await assertSheetEditable(sheetId);
  if (!Number.isFinite(sheetId) || sheetId <= 0) throw new HttpError(400, "Invalid sheetId");
  if (!Number.isFinite(noteId) || noteId <= 0) throw new HttpError(400, "Invalid noteId");

  const pool = await poolPromise;
  const del = await pool.request()
    .input("NoteID", sql.Int, noteId)
    .input("SheetID", sql.Int, sheetId)
    .query(`
      DELETE FROM dbo.SheetNotes
      WHERE NoteID = @NoteID AND SheetID = @SheetID;

      SELECT @@ROWCOUNT AS Affected;
    `);

  const affected: number = del.recordset?.[0]?.Affected ?? 0;
  if (affected === 0) throw new HttpError(404, "Note not found");
}

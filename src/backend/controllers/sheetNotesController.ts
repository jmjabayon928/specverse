// src/backend/controllers/sheetNotesController.ts
import type { RequestHandler } from "express";
import { getSheetNotes, createNote, updateNote, deleteNoteById } from "@/backend/services/sheetNotesService";
import { getErrorMessage } from "@/utils/errors";

/**
 * GET /api/backend/sheets/:sheetId/notes
 * Returns all notes for a sheet (grouping/sorting is handled on the client)
 */
export const listNotes: RequestHandler = async (req, res) => {
  const sheetId = Number(req.params.sheetId);
  if (!Number.isFinite(sheetId) || sheetId <= 0) {
    return res.status(400).json({ error: "Invalid sheetId" });
  }

  try {
    const notes = await getSheetNotes(sheetId);
    // Stop caches from returning 304s for this API
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(notes);
  } catch (err: unknown) {
    const message = getErrorMessage(err);
    return res.status(500).json({ error: message });
  }
};

// POST /api/backend/sheets/:sheetId/notes
export const createNoteHandler: RequestHandler = async (req, res) => {
  const sheetId = Number(req.params.sheetId);
  const { noteTypeId, noteText, orderIndex } = req.body ?? {};
  if (!Number.isFinite(sheetId) || !Number.isFinite(noteTypeId) || typeof noteText !== "string") {
    return res.status(400).json({ error: "Invalid payload" });
  }
  try {
    const created = await createNote({
      sheetId,
      noteTypeId: Number(noteTypeId),
      noteText,
      orderIndex: Number.isFinite(orderIndex) ? Number(orderIndex) : 0,
      createdBy: (req as unknown as { user?: { userId?: number } }).user?.userId ?? null
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json(created);
  } catch (err: unknown) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

// PUT /api/backend/sheets/:sheetId/notes/:noteId
export const updateNoteHandler: RequestHandler = async (req, res) => {
  const sheetId = Number(req.params.sheetId);
  const noteId = Number(req.params.noteId);
  const { noteTypeId, noteText, orderIndex } = req.body ?? {};
  if (!Number.isFinite(sheetId) || !Number.isFinite(noteId)) {
    return res.status(400).json({ error: "Invalid ids" });
  }
  try {
    const updated = await updateNote({
      noteId,
      sheetId,
      noteTypeId: Number.isFinite(noteTypeId) ? Number(noteTypeId) : undefined,
      noteText: typeof noteText === "string" ? noteText : undefined,
      orderIndex: Number.isFinite(orderIndex) ? Number(orderIndex) : undefined,
      updatedBy: (req as unknown as { user?: { userId?: number } }).user?.userId ?? null
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(updated);
  } catch (err: unknown) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

// DELETE /api/backend/sheets/:sheetId/notes/:noteId
export const deleteNoteHandler: RequestHandler = async (req, res) => {
  const sheetId = Number(req.params.sheetId);
  const noteId = Number(req.params.noteId);
  if (!Number.isFinite(sheetId) || !Number.isFinite(noteId)) {
    return res.status(400).json({ error: "Invalid ids" });
  }
  try {
    await deleteNoteById({ sheetId, noteId });
    res.setHeader("Cache-Control", "no-store");
    return res.status(204).end();
  } catch (err: unknown) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

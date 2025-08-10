import type { RequestHandler } from "express";
import { getNoteTypes } from "@/backend/services/noteTypesService";
import { getErrorMessage } from "@/utils/errors";

export const listNoteTypes: RequestHandler = async (_req, res) => {
  try {
    const rows = await getNoteTypes();
    return res.json(rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: getErrorMessage(err) });
  }
};

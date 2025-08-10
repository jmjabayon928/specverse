import express from "express";
import { verifyToken, requirePermission } from "../middleware/authMiddleware";
import * as controller from "@/backend/controllers/sheetNotesController";

const router = express.Router();

router.get("/sheets/:sheetId/notes", /*verifyToken,*/ controller.listNotes);
router.post(
  "/sheets/:sheetId/notes",
  verifyToken,
  requirePermission("NOTE_CREATE"),
  controller.createNoteHandler
);
router.put(
  "/sheets/:sheetId/notes/:noteId",
  verifyToken,
  requirePermission("NOTE_EDIT"),
  controller.updateNoteHandler
);
router.delete(
  "/sheets/:sheetId/notes/:noteId",
  verifyToken,
  requirePermission("NOTE_DELETE"),
  controller.deleteNoteHandler
);

export default router;

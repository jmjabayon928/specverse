import express from "express";
import { listNoteTypes } from "@/backend/controllers/noteTypesController";
// If you need auth, add verifyToken; you said “everyone can view”, so it’s open.
const router = express.Router();

router.get("/note-types", listNoteTypes);

export default router;

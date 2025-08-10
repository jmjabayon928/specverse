// src/backend/routes/attachmentsRoutes.ts
import express from "express";
import { verifyToken, requirePermission } from "../middleware/authMiddleware";
import {
  listBySheet,
  uploadToSheet,
  deleteFromSheet,
  streamAttachment,
  uploadMiddleware,
} from "../controllers/attachmentsController";

const router = express.Router();

router.get("/sheets/:sheetId/attachments", verifyToken, listBySheet);

router.post(
  "/sheets/:sheetId/attachments",
  verifyToken,
  requirePermission("ATTACHMENT_CREATE"),
  uploadMiddleware, 
  uploadToSheet
);

router.delete(
  "/sheets/:sheetId/attachments/:attachmentId",
  verifyToken,
  requirePermission("ATTACHMENT_DELETE"),
  deleteFromSheet
);

// Inline/preview or download (use ?disposition=attachment to force download)
router.get("/attachments/:attachmentId/view", verifyToken, streamAttachment);

export default router;

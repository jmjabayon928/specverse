// src/backend/routes/filledSheetRoutes.ts
import express from 'express'

import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { auditAction } from '@/backend/middleware/auditMiddleware'
import { uploadAttachment } from '@/backend/utils/attachmentUpload'

import {
  // Lists & references
  getAllFilled,
  getReferenceOptions,

  // Core CRUD
  getFilledSheetById,
  createFilledSheetHandler,
  updateFilledSheetHandler,
  verifyFilledSheetHandler,
  approveFilledSheetHandler,

  // Clone
  cloneFilledSheetHandler,

  // Attachments
  uploadFilledSheetAttachmentHandler,
  listFilledSheetAttachmentsHandler,
  deleteFilledSheetAttachmentHandler,

  // Notes
  listFilledSheetNotesHandler,
  createFilledSheetNoteHandler,
  updateFilledSheetNoteHandler,
  deleteFilledSheetNoteHandler,

  // Export / utilities
  exportFilledSheetPDF,
  exportFilledSheetExcel,
  checkEquipmentTag,
} from "../controllers/filledSheetController";

const router = express.Router();

/* ──────────────────────────────────────────────────────────────
   Health
   ────────────────────────────────────────────────────────────── */
router.get("/health", (_req, res) => res.json({ ok: true }));

/* ──────────────────────────────────────────────────────────────
   Collection & reference (keep BEFORE any "/:id" routes)
   ────────────────────────────────────────────────────────────── */

// List all filled sheets (non-templates)
router.get(
  "/",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getAllFilled
);

// Reference dropdown options (categories, users, etc.)
router.get(
  "/reference-options",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getReferenceOptions
);

/* ──────────────────────────────────────────────────────────────
   Utilities
   ────────────────────────────────────────────────────────────── */

// Check equipment-tag uniqueness (typically per project)
router.get(
  "/check-equipment-tag",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  checkEquipmentTag
);

/* ──────────────────────────────────────────────────────────────
   Export
   ────────────────────────────────────────────────────────────── */

router.get(
  "/export/:id/pdf",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  exportFilledSheetPDF
);

router.get(
  "/export/:id/excel",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  exportFilledSheetExcel
);

/* ──────────────────────────────────────────────────────────────
   Create & Clone
   ────────────────────────────────────────────────────────────── */

// Create new filled sheet
router.post(
  "/",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Create Filled Sheet"),
  createFilledSheetHandler
);

// Clone existing sheet into a new filled sheet
router.post(
  "/:id/clone",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Clone Filled Sheet"),
  cloneFilledSheetHandler
);

/* ──────────────────────────────────────────────────────────────
   Attachments (keep BEFORE generic "/:id")
   ────────────────────────────────────────────────────────────── */

// List attachments for a sheet
router.get(
  "/:id/attachments",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  listFilledSheetAttachmentsHandler
);

// Upload one attachment (multipart/form-data; field name: "file")
router.post(
  "/:id/attachments",
  verifyToken,
  requirePermission("DATASHEET_ATTACHMENT_UPLOAD"),
  uploadAttachment.single("file"),
  auditAction("Upload Filled Sheet Attachment"),
  uploadFilledSheetAttachmentHandler
)

// Delete attachment by id
router.delete(
  "/:id/attachments/:attachmentId",
  verifyToken,
  requirePermission("DATASHEET_ATTACHMENT_DELETE"),
  auditAction("Delete Filled Sheet Attachment"),
  deleteFilledSheetAttachmentHandler
);

/* ──────────────────────────────────────────────────────────────
   Notes (keep BEFORE generic "/:id")
   ────────────────────────────────────────────────────────────── */

// List notes for a sheet
router.get(
  "/:id/notes",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  listFilledSheetNotesHandler
);

// Create note
router.post(
  "/:id/notes",
  verifyToken,
  requirePermission("DATASHEET_NOTE_EDIT"),
  auditAction("Create Filled Sheet Note"),
  createFilledSheetNoteHandler
);

// Update note
router.put(
  "/:id/notes/:noteId",
  verifyToken,
  requirePermission("DATASHEET_NOTE_EDIT"),
  auditAction("Update Filled Sheet Note"),
  updateFilledSheetNoteHandler
);

// Delete note
router.delete(
  "/:id/notes/:noteId",
  verifyToken,
  requirePermission("DATASHEET_NOTE_EDIT"),
  auditAction("Delete Filled Sheet Note"),
  deleteFilledSheetNoteHandler
);

/* ──────────────────────────────────────────────────────────────
   ID-scoped CRUD (keep LAST so it doesn't swallow the above)
   ────────────────────────────────────────────────────────────── */

router.get(
  "/:id",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getFilledSheetById
);

router.put(
  "/:id",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Update Filled Sheet"),
  updateFilledSheetHandler
);

router.post(
  "/:id/verify",
  verifyToken,
  requirePermission("DATASHEET_VERIFY"),
  auditAction("Verify Filled Sheet"),
  verifyFilledSheetHandler
);

router.post(
  "/:id/approve",
  verifyToken,
  requirePermission("DATASHEET_APPROVE"),
  auditAction("Approve Filled Sheet"),
  approveFilledSheetHandler
);

export default router;

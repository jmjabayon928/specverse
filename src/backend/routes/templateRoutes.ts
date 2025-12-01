// src/backend/routes/templateRoutes.ts

import express from "express"

import { verifyToken, requirePermission } from "@/backend/middleware/authMiddleware"
import { auditAction } from "@/backend/middleware/auditMiddleware"
import { uploadAttachment } from "@/backend/utils/attachmentUpload"

import {
  templateHealth,
  getAllTemplatesHandler,
  getTemplateReferenceOptionsHandler,
  getTemplateByIdHandler,
  getTemplateStructureHandler,
  createTemplateHandler,
  updateTemplateHandler,
  verifyTemplateHandler,
  approveTemplateHandler,
  cloneTemplateHandler,
  // notes
  listTemplateNotesHandler,
  createTemplateNoteHandler,
  updateTemplateNoteHandler,
  deleteTemplateNoteHandler,
  getAllNoteTypesHandler,
  // attachments
  listTemplateAttachmentsHandler,
  uploadTemplateAttachmentHandler,
  deleteTemplateAttachmentHandler,
  // export
  exportTemplatePDFHandler,
  exportTemplateExcelHandler,
  // equipment tag check (stub in controller)
  checkTemplateEquipmentTagHandler,
} from "@/backend/controllers/templateController"

const router = express.Router()

/* ───────────────────────────────────────────
   Health
   ─────────────────────────────────────────── */

router.get("/health", templateHealth)

/* ───────────────────────────────────────────
   Collections & reference
   ─────────────────────────────────────────── */

// List all templates
router.get(
  "/",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getAllTemplatesHandler
)

// Reference options (categories, users, etc.)
router.get(
  "/reference-options",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getTemplateReferenceOptionsHandler
)

/* ───────────────────────────────────────────
   Single template
   ─────────────────────────────────────────── */

// Get template details by ID
router.get(
  "/:id",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getTemplateByIdHandler
)

// Structure for the datasheet builder
router.get(
  "/:id/structure",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getTemplateStructureHandler
)

/* ───────────────────────────────────────────
   Create / Update / Clone
   ─────────────────────────────────────────── */

// Create template
router.post(
  "/",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Create Template"),
  createTemplateHandler
)

// Update template
router.put(
  "/:id",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Update Template"),
  updateTemplateHandler
)

// Clone from existing template
router.post(
  "/:id/clone",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Clone Template"),
  cloneTemplateHandler
)

/* ───────────────────────────────────────────
   Verify / Approve
   ─────────────────────────────────────────── */

router.post(
  "/:id/verify",
  verifyToken,
  requirePermission("DATASHEET_VERIFY"),
  auditAction("Verify Template"),
  verifyTemplateHandler
)

router.post(
  "/:id/approve",
  verifyToken,
  requirePermission("DATASHEET_APPROVE"),
  auditAction("Approve Template"),
  approveTemplateHandler
)

/* ───────────────────────────────────────────
   Notes
   ─────────────────────────────────────────── */

// List notes for a template
router.get(
  "/:id/notes",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  listTemplateNotesHandler
)

// Create note
router.post(
  "/:id/notes",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Create Template Note"),
  createTemplateNoteHandler
)

// Update note
router.put(
  "/:id/notes/:noteId",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Update Template Note"),
  updateTemplateNoteHandler
)

// Delete note
router.delete(
  "/:id/notes/:noteId",
  verifyToken,
  requirePermission("DATASHEET_EDIT"),
  auditAction("Delete Template Note"),
  deleteTemplateNoteHandler
)

// List note types
router.get(
  "/note-types",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  getAllNoteTypesHandler
)

/* ───────────────────────────────────────────
   Attachments
   ─────────────────────────────────────────── */

// List attachments
router.get(
  "/:id/attachments",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  listTemplateAttachmentsHandler
)

// Upload attachment
router.post(
  "/:id/attachments",
  verifyToken,
  requirePermission("DATASHEET_ATTACHMENT_UPLOAD"),
  uploadAttachment.single("file"),
  auditAction("Upload Template Attachment"),
  uploadTemplateAttachmentHandler
)

// Delete attachment
router.delete(
  "/:id/attachments/:attachmentId",
  verifyToken,
  requirePermission("DATASHEET_ATTACHMENT_UPLOAD"),
  auditAction("Delete Template Attachment"),
  deleteTemplateAttachmentHandler
)

/* ───────────────────────────────────────────
   Export
   ─────────────────────────────────────────── */

router.get(
  "/:id/export/pdf",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  auditAction("Export Template PDF"),
  exportTemplatePDFHandler
)

router.get(
  "/:id/export/excel",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  auditAction("Export Template Excel"),
  exportTemplateExcelHandler
)

/* ───────────────────────────────────────────
   Equipment Tag Check (stub)
   ─────────────────────────────────────────── */

router.get(
  "/equipment-tag/check",
  verifyToken,
  requirePermission("DATASHEET_VIEW"),
  checkTemplateEquipmentTagHandler
)

export default router

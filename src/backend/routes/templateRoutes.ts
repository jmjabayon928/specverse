// src/backend/routes/templateRoutes.ts

import { Router } from 'express'

import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { auditAction } from '@/backend/middleware/auditMiddleware'
import { uploadAttachment } from '@/backend/utils/attachmentUpload'

import {
  templateHealth,
  getAllTemplatesHandler,
  getTemplateReferenceOptionsHandler,
  getTemplateById,
  getTemplateStructure,
  createTemplateHandler,
  updateTemplateHandler,
  verifyTemplateHandler,
  approveTemplateHandler,
  cloneTemplateHandler,
  // template structure (subsheets + fields)
  createSubsheetHandler,
  updateSubsheetHandler,
  deleteSubsheetHandler,
  reorderSubsheetsHandler,
  createFieldHandler,
  updateFieldHandler,
  deleteFieldHandler,
  reorderFieldsHandler,
  // notes
  listTemplateNotesHandler,
  createTemplateNoteHandler,
  updateTemplateNoteHandler,
  deleteTemplateNoteHandler,
  getNoteTypesHandler,
  // attachments
  listTemplateAttachmentsHandler,
  uploadTemplateAttachmentHandler,
  deleteTemplateAttachmentHandler,
  // export
  exportTemplatePDF,
  exportTemplateExcel,
  // equipment tag check
  checkTemplateEquipmentTagHandler,
} from '@/backend/controllers/templateController'

const router = Router()

// ───────────────────────────────────────────
// Health
// ───────────────────────────────────────────

router.get('/health', templateHealth)

// ───────────────────────────────────────────
// Collections & reference
// ───────────────────────────────────────────

// List all templates
router.get(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getAllTemplatesHandler,
)

// Reference options (categories, users, etc.)
router.get(
  '/reference-options',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getTemplateReferenceOptionsHandler,
)

// Fixed paths (must be before /:id so they are not matched as id)
router.get(
  '/note-types',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getNoteTypesHandler,
)
router.get(
  '/equipment-tag/check',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  checkTemplateEquipmentTagHandler,
)

// ───────────────────────────────────────────
// Single template (structure routes first so :id/subsheets/* match)
// ───────────────────────────────────────────

// Subsheet order (bulk)
router.put(
  '/:id/subsheets/order',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  reorderSubsheetsHandler,
)

// Subsheet CRUD
router.post(
  '/:id/subsheets',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  createSubsheetHandler,
)
router.patch(
  '/:id/subsheets/:subId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  updateSubsheetHandler,
)
router.delete(
  '/:id/subsheets/:subId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  deleteSubsheetHandler,
)

// Field CRUD (under subsheet)
router.post(
  '/:id/subsheets/:subId/fields',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  createFieldHandler,
)
router.put(
  '/:id/subsheets/:subId/fields/order',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  reorderFieldsHandler,
)
router.patch(
  '/:id/subsheets/:subId/fields/:fieldId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  updateFieldHandler,
)
router.delete(
  '/:id/subsheets/:subId/fields/:fieldId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  deleteFieldHandler,
)

// Get template details by ID
router.get(
  '/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getTemplateById,
)

// Structure for the datasheet builder
router.get(
  '/:sheetId/structure',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getTemplateStructure,
)

// ───────────────────────────────────────────
// Create / Update / Clone
// ───────────────────────────────────────────

// Create template
router.post(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  createTemplateHandler,
)

// Update template
router.put(
  '/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  auditAction('Update Template', { tableName: 'Sheets', recordIdParam: 'id' }),
  updateTemplateHandler,
)

// Clone from existing template
router.post(
  '/:id/clone',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  auditAction('Clone Template'),
  cloneTemplateHandler,
)

// ───────────────────────────────────────────
// Verify / Approve
// ───────────────────────────────────────────

router.post(
  '/:id/verify',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VERIFY),
  verifyTemplateHandler,
)

router.post(
  '/:id/approve',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_APPROVE),
  approveTemplateHandler,
)

// ───────────────────────────────────────────
// Notes
// ───────────────────────────────────────────

// List notes for a template
router.get(
  '/:id/notes',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listTemplateNotesHandler,
)

// Create note
router.post(
  '/:id/notes',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_NOTE_EDIT),
  auditAction('Create Template Note'),
  createTemplateNoteHandler,
)

// Update note
router.put(
  '/:id/notes/:noteId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_NOTE_EDIT),
  auditAction('Update Template Note'),
  updateTemplateNoteHandler,
)

// Delete note
router.delete(
  '/:id/notes/:noteId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_NOTE_EDIT),
  auditAction('Delete Template Note'),
  deleteTemplateNoteHandler,
)

// ───────────────────────────────────────────
// Attachments
// ───────────────────────────────────────────

// List attachments
router.get(
  '/:id/attachments',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listTemplateAttachmentsHandler,
)

// Upload attachment
router.post(
  '/:id/attachments',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD),
  uploadAttachment.single('file'),
  auditAction('Upload Template Attachment'),
  uploadTemplateAttachmentHandler,
)

// Delete attachment
router.delete(
  '/:id/attachments/:attachmentId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD),
  auditAction('Delete Template Attachment'),
  deleteTemplateAttachmentHandler,
)

// ───────────────────────────────────────────
// Export
// ───────────────────────────────────────────

// Keep original path style: /export/:id/pdf
router.get(
  '/export/:id/pdf',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EXPORT),
  auditAction('Export Template PDF'),
  exportTemplatePDF,
)

router.get(
  '/export/:id/excel',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EXPORT),
  auditAction('Export Template Excel'),
  exportTemplateExcel,
)

export default router

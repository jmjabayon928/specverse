// src/backend/routes/templateRoutes.ts

import { Router } from 'express'

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
  requirePermission('DATASHEET_VIEW'),
  getAllTemplatesHandler,
)

// Reference options (categories, users, etc.)
router.get(
  '/reference-options',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  getTemplateReferenceOptionsHandler,
)

// Fixed paths (must be before /:id so they are not matched as id)
router.get(
  '/note-types',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  getNoteTypesHandler,
)
router.get(
  '/check-tag',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  checkTemplateEquipmentTagHandler,
)

// ───────────────────────────────────────────
// Single template (structure routes first so :id/subsheets/* match)
// ───────────────────────────────────────────

// Subsheet order (bulk)
router.put(
  '/:id/subsheets/order',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  reorderSubsheetsHandler,
)

// Subsheet CRUD
router.post(
  '/:id/subsheets',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  createSubsheetHandler,
)
router.patch(
  '/:id/subsheets/:subId',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  updateSubsheetHandler,
)
router.delete(
  '/:id/subsheets/:subId',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  deleteSubsheetHandler,
)

// Field CRUD (under subsheet)
router.post(
  '/:id/subsheets/:subId/fields',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  createFieldHandler,
)
router.put(
  '/:id/subsheets/:subId/fields/order',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  reorderFieldsHandler,
)
router.patch(
  '/:id/subsheets/:subId/fields/:fieldId',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  updateFieldHandler,
)
router.delete(
  '/:id/subsheets/:subId/fields/:fieldId',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  deleteFieldHandler,
)

// Get template details by ID
router.get(
  '/:id',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  getTemplateById,
)

// Structure for the datasheet builder
router.get(
  '/:sheetId/structure',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  getTemplateStructure,
)

// ───────────────────────────────────────────
// Create / Update / Clone
// ───────────────────────────────────────────

// Create template
router.post(
  '/',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  createTemplateHandler,
)

// Update template
router.put(
  '/:id',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  auditAction('Update Template', { tableName: 'Sheets', recordIdParam: 'id' }),
  updateTemplateHandler,
)

// Clone from existing template
router.post(
  '/:id/clone',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  auditAction('Clone Template'),
  cloneTemplateHandler,
)

// ───────────────────────────────────────────
// Verify / Approve
// ───────────────────────────────────────────

router.post(
  '/:id/verify',
  verifyToken,
  requirePermission('DATASHEET_VERIFY'),
  auditAction('Verify Template', { tableName: 'Sheets', recordIdParam: 'id' }),
  verifyTemplateHandler,
)

router.post(
  '/:id/approve',
  verifyToken,
  requirePermission('DATASHEET_APPROVE'),
  auditAction('Approve Template', { tableName: 'Sheets', recordIdParam: 'id' }),
  approveTemplateHandler,
)

// ───────────────────────────────────────────
// Notes
// ───────────────────────────────────────────

// List notes for a template
router.get(
  '/:id/notes',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  listTemplateNotesHandler,
)

// Create note
router.post(
  '/:id/notes',
  verifyToken,
  requirePermission('DATASHEET_NOTE_EDIT'),
  auditAction('Create Template Note'),
  createTemplateNoteHandler,
)

// Update note
router.put(
  '/:id/notes/:noteId',
  verifyToken,
  requirePermission('DATASHEET_NOTE_EDIT'),
  auditAction('Update Template Note'),
  updateTemplateNoteHandler,
)

// Delete note
router.delete(
  '/:id/notes/:noteId',
  verifyToken,
  requirePermission('DATASHEET_NOTE_EDIT'),
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
  requirePermission('DATASHEET_VIEW'),
  listTemplateAttachmentsHandler,
)

// Upload attachment
router.post(
  '/:id/attachments',
  verifyToken,
  requirePermission('DATASHEET_ATTACHMENT_UPLOAD'),
  uploadAttachment.single('file'),
  auditAction('Upload Template Attachment'),
  uploadTemplateAttachmentHandler,
)

// Delete attachment
router.delete(
  '/:id/attachments/:attachmentId',
  verifyToken,
  requirePermission('DATASHEET_ATTACHMENT_UPLOAD'),
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
  requirePermission('DATASHEET_VIEW'),
  auditAction('Export Template PDF'),
  exportTemplatePDF,
)

router.get(
  '/export/:id/excel',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  auditAction('Export Template Excel'),
  exportTemplateExcel,
)

export default router

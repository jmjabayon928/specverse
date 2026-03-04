import { Router } from 'express'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { uploadAttachment } from '@/backend/utils/attachmentUpload'
import {
  createChecklistRunHandler,
  getChecklistRunHandler,
  patchChecklistRunEntryHandler,
  uploadChecklistEvidenceHandler,
} from '@/backend/controllers/checklistsController'

const router = Router()

const PERMISSIONS = {
  CHECKLISTS_RUN_CREATE: 'CHECKLISTS_RUN_CREATE',
  CHECKLISTS_RUN_VIEW: 'CHECKLISTS_RUN_VIEW',
  CHECKLISTS_RUN_EXECUTE: 'CHECKLISTS_RUN_EXECUTE',
  CHECKLISTS_EVIDENCE_UPLOAD: 'CHECKLISTS_EVIDENCE_UPLOAD',
} as const

router.post(
  '/run',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_RUN_CREATE),
  createChecklistRunHandler,
)

router.get(
  '/runs/:runId',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_RUN_VIEW),
  getChecklistRunHandler,
)

router.patch(
  '/run-entries/:runEntryId',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_RUN_EXECUTE),
  patchChecklistRunEntryHandler,
)

router.post(
  '/run-entries/:runEntryId/evidence',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_EVIDENCE_UPLOAD),
  uploadAttachment.single('file'),
  uploadChecklistEvidenceHandler,
)

export default router

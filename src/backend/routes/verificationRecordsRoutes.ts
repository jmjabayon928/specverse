// src/backend/routes/verificationRecordsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import {
  listVerificationRecords,
  getVerificationRecordById,
  createVerificationRecord,
  linkVerificationRecordToSheet,
  unlinkVerificationRecordFromSheet,
  attachEvidenceToVerificationRecord,
  listVerificationRecordAttachments,
  listVerificationRecordTypes,
} from '../controllers/verificationRecordsController'

const router = Router()

// Reference data route (before collection routes)
router.get(
  '/verification-record-types',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listVerificationRecordTypes
)

// Collection routes (before /:id)
router.get(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listVerificationRecords
)

router.post(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  createVerificationRecord
)

// Item routes (/:id)
router.get(
  '/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getVerificationRecordById
)

router.post(
  '/:id/link',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  linkVerificationRecordToSheet
)

router.post(
  '/:id/unlink',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  unlinkVerificationRecordFromSheet
)

router.post(
  '/:id/attachments',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  attachEvidenceToVerificationRecord
)

router.get(
  '/:id/attachments',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listVerificationRecordAttachments
)

export default router

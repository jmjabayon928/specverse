// src/backend/routes/assetsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { listAssets, getAssetById, getAssetCustomFields } from '../controllers/assetsController'
import { listDatasheetsForAsset } from '../controllers/filledSheetController'
import { listAssetDocuments, linkAssetDocument, unlinkAssetDocument } from '../controllers/assetDocumentsController'
import { getAssetActivity } from '../controllers/assetActivityController'
import { auditAction } from '@/backend/middleware/auditMiddleware'

const router = Router()

router.get(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listAssets
)

router.get(
  '/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getAssetById
)

router.get(
  '/:id/custom-fields',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getAssetCustomFields
)

router.get(
  '/:assetId/datasheets',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listDatasheetsForAsset
)

router.get(
  '/:assetId/documents',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listAssetDocuments
)

router.get(
  '/:assetId/activity',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getAssetActivity
)

router.post(
  '/:assetId/documents/link',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  requirePermission(PERMISSIONS.DATASHEET_ATTACHMENT_UPLOAD),
  auditAction('Link Asset Document', { tableName: 'Assets', recordIdParam: 'assetId' }),
  linkAssetDocument
)

router.delete(
  '/:assetId/documents/:attachmentId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  requirePermission(PERMISSIONS.DATASHEET_ATTACHMENT_DELETE),
  auditAction('Unlink Asset Document', { tableName: 'Assets', recordIdParam: 'assetId' }),
  unlinkAssetDocument
)

export default router

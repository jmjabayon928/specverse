// src/backend/routes/assetsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { listAssets, getAssetById, getAssetCustomFields } from '../controllers/assetsController'
import { listDatasheetsForAsset } from '../controllers/filledSheetController'

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

export default router

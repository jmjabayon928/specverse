// src/backend/routes/valueSetRoutes.ts
import { Router } from 'express'

import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import {
  getSheetValueSets,
  postSheetValueSet,
  patchSheetValueSetVariances,
  postSheetValueSetStatus,
  getSheetCompare,
} from '@/backend/controllers/valueSetController'

const router = Router()

router.get(
  '/:sheetId/compare',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getSheetCompare
)

router.get(
  '/:sheetId/valuesets',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getSheetValueSets
)

router.post(
  '/:sheetId/valuesets',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  postSheetValueSet
)

router.patch(
  '/:sheetId/valuesets/:valueSetId/variances',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  patchSheetValueSetVariances
)

router.post(
  '/:sheetId/valuesets/:valueSetId/status',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  postSheetValueSetStatus
)

export default router

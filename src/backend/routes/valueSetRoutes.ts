// src/backend/routes/valueSetRoutes.ts
import { Router } from 'express'

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
  requirePermission('DATASHEET_VIEW'),
  getSheetCompare
)

router.get(
  '/:sheetId/valuesets',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  getSheetValueSets
)

router.post(
  '/:sheetId/valuesets',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  postSheetValueSet
)

router.patch(
  '/:sheetId/valuesets/:valueSetId/variances',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  patchSheetValueSetVariances
)

router.post(
  '/:sheetId/valuesets/:valueSetId/status',
  verifyToken,
  requirePermission('DATASHEET_EDIT'),
  postSheetValueSetStatus
)

export default router

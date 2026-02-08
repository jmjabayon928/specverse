// src/backend/routes/datasheetRatingsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { listRatingsBlocksForSheet } from '../controllers/ratingsController'

const router = Router()

router.get(
  '/:sheetId/ratings',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listRatingsBlocksForSheet
)

export default router

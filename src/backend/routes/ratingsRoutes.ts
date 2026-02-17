// src/backend/routes/ratingsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import {
  listRatingsTemplatesHandler,
  getRatingsTemplateByIdHandler,
  getRatingsBlockById,
  createRatingsBlock,
  updateRatingsBlock,
  deleteRatingsBlock,
  lockRatingsBlock,
  unlockRatingsBlock,
} from '../controllers/ratingsController'

const router = Router()

router.get(
  '/templates',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listRatingsTemplatesHandler
)

router.get(
  '/templates/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getRatingsTemplateByIdHandler
)

router.get(
  '/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getRatingsBlockById
)

router.post(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  createRatingsBlock
)

router.patch(
  '/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  updateRatingsBlock
)

router.delete(
  '/:id',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  deleteRatingsBlock
)

router.post(
  '/:id/lock',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  lockRatingsBlock
)

router.post(
  '/:id/unlock',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  unlockRatingsBlock
)

export default router

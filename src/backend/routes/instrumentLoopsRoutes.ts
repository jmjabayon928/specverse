// src/backend/routes/instrumentLoopsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { list, getOne } from '../controllers/instrumentLoopsController'

const router = Router()

router.get(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  list
)

router.get(
  '/:loopId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getOne
)

export default router

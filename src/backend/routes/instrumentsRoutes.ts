// src/backend/routes/instrumentsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { list, getOne, create, updateOne } from '../controllers/instrumentsController'

const router = Router()

router.get(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  list
)

router.get(
  '/:instrumentId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getOne
)

router.post(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  create
)

router.patch(
  '/:instrumentId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  updateOne
)

export default router

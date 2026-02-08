// src/backend/routes/schedulesRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import {
  listSchedules,
  createSchedule,
  getScheduleById,
  patchSchedule,
  putScheduleColumns,
  putScheduleEntries,
} from '../controllers/schedulesController'

const router = Router()

router.get(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listSchedules
)

router.post(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  createSchedule
)

router.get(
  '/:scheduleId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getScheduleById
)

router.patch(
  '/:scheduleId',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  patchSchedule
)

router.put(
  '/:scheduleId/columns',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  putScheduleColumns
)

router.put(
  '/:scheduleId/entries',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  putScheduleEntries
)

export default router

// src/backend/routes/schedulesRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import {
  listSchedules,
  countSchedules,
  searchSheetOptions,
  searchFacilityOptions,
  searchSpaceOptions,
  searchSystemOptions,
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
  requirePermission(PERMISSIONS.SCHEDULES_VIEW),
  listSchedules
)

router.get(
  '/count',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_VIEW),
  countSchedules
)

router.get(
  '/sheet-options',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_VIEW),
  searchSheetOptions
)

router.get(
  '/facility-options',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_VIEW),
  searchFacilityOptions
)

router.get(
  '/space-options',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_VIEW),
  searchSpaceOptions
)

router.get(
  '/system-options',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_VIEW),
  searchSystemOptions
)

router.post(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_EDIT),
  createSchedule
)

router.get(
  '/:scheduleId',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_VIEW),
  getScheduleById
)

router.patch(
  '/:scheduleId',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_EDIT),
  patchSchedule
)

router.put(
  '/:scheduleId/columns',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_EDIT),
  putScheduleColumns
)

router.put(
  '/:scheduleId/entries',
  verifyToken,
  requirePermission(PERMISSIONS.SCHEDULES_EDIT),
  putScheduleEntries
)

export default router

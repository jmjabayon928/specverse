// src/backend/routes/facilitiesRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import {
  listFacilities,
  getFacilityById,
  listSystems,
  getSystemById,
} from '../controllers/facilitiesController'

const router = Router()

router.get(
  '/',
  verifyToken,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  listFacilities
)

router.get(
  '/:facilityId',
  verifyToken,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  getFacilityById
)

router.get(
  '/:facilityId/systems',
  verifyToken,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  listSystems
)

router.get(
  '/:facilityId/systems/:systemId',
  verifyToken,
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  getSystemById
)

export default router

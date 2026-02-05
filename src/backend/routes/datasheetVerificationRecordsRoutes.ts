// src/backend/routes/datasheetVerificationRecordsRoutes.ts
// Minimal router for nested verification-records route only
// (datasheets routes are intentionally disabled in app.ts)
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { listVerificationRecordsForSheet } from '../controllers/verificationRecordsController'

const router = Router()

// Nested resource: verification records for a sheet
router.get(
  '/:sheetId/verification-records',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listVerificationRecordsForSheet
)

export default router

// src/backend/routes/sheetLogsRoutes.ts
import { Router } from 'express'

import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import {
  getSheetAuditLogs,
  getSheetChangeLogs,
  getSheetLogsMerged,
} from '@/backend/controllers/sheetLogsController'

const router = Router()

router.get(
  '/:sheetId/audit-logs',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getSheetAuditLogs,
)

router.get(
  '/:sheetId/change-logs',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getSheetChangeLogs,
)

router.get(
  '/:sheetId/logs',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  getSheetLogsMerged,
)

export default router


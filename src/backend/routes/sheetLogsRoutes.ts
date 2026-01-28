// src/backend/routes/sheetLogsRoutes.ts
import { Router } from 'express'

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
  requirePermission('DATASHEET_VIEW'),
  getSheetAuditLogs,
)

router.get(
  '/:sheetId/change-logs',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  getSheetChangeLogs,
)

router.get(
  '/:sheetId/logs',
  verifyToken,
  requirePermission('DATASHEET_VIEW'),
  getSheetLogsMerged,
)

export default router


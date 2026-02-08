// src/backend/routes/datasheetInstrumentsRoutes.ts
import { Router } from 'express'
import { PERMISSIONS } from '@/constants/permissions'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { listLinkedToSheet, linkToSheet, unlinkFromSheet } from '../controllers/instrumentsController'

const router = Router()

router.get(
  '/:sheetId/instruments',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_VIEW),
  listLinkedToSheet
)

router.post(
  '/:sheetId/instruments/:instrumentId/link',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  linkToSheet
)

router.delete(
  '/:sheetId/instruments/:instrumentId/link',
  verifyToken,
  requirePermission(PERMISSIONS.DATASHEET_EDIT),
  unlinkFromSheet
)

export default router

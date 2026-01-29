// src/backend/routes/auditLogsRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import { requireAdmin } from '../middleware/requireAdmin'
import { listAuditLogsHandler } from '../controllers/auditLogsController'

const router = Router()

router.get('/', verifyToken, requireAdmin, listAuditLogsHandler)

export default router

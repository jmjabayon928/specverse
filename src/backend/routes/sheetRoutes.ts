// src/backend/routes/sheetRoutes.ts
// Aggregates sheet-scoped routes: logs (audit, change, merged) and value sets.

import { Router } from 'express'
import sheetLogsRoutes from './sheetLogsRoutes'
import valueSetRoutes from './valueSetRoutes'

const router = Router()

router.use('/', valueSetRoutes)
router.use('/', sheetLogsRoutes)

export default router

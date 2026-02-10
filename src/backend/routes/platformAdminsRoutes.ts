// src/backend/routes/platformAdminsRoutes.ts
import { Router } from 'express'
import { verifyTokenOnly } from '../middleware/authMiddleware'
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin'
import {
  listPlatformAdmins,
  revokePlatformAdminHandler,
  grantPlatformAdminHandler,
} from '../controllers/platformAdminsController'

const router = Router()

router.get('/', verifyTokenOnly, requirePlatformAdmin, listPlatformAdmins)
router.post('/:userId/revoke', verifyTokenOnly, requirePlatformAdmin, revokePlatformAdminHandler)
router.post('/:userId/grant', verifyTokenOnly, requirePlatformAdmin, grantPlatformAdminHandler)

export default router

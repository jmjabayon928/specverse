// src/backend/routes/adminRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin'
import { resetPassword } from '../controllers/usersController'

const router = Router()

// Platform admin only: reset any user's password
router.post('/users/:userId/reset-password', verifyToken, requirePlatformAdmin, resetPassword)

export default router

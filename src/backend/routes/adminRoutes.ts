// src/backend/routes/adminRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import { requireAdmin } from '../middleware/requireAdmin'
import { resetPassword } from '../controllers/usersController'

const router = Router()

// All admin routes require authentication and admin role
router.post('/users/:userId/reset-password', verifyToken, requireAdmin, resetPassword)

export default router

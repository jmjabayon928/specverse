// src/backend/routes/usersRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import { requirePlatformAdmin } from '../middleware/requirePlatformAdmin'
import {
  getUsers,      // legacy /users
  listUsers,     // new paged list
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/usersController'

const router = Router()

// Legacy route: platform admin only (global Users)
router.get('/users', verifyToken, requirePlatformAdmin, getUsers)

// Newer settings API (mounted under /api/backend/settings/users): platform admin only
router.get('/', verifyToken, requirePlatformAdmin, listUsers)
router.get('/:id', verifyToken, requirePlatformAdmin, getUser)
router.post('/', verifyToken, requirePlatformAdmin, createUser)
router.patch('/:id', verifyToken, requirePlatformAdmin, updateUser)
router.delete('/:id', verifyToken, requirePlatformAdmin, deleteUser)

export default router

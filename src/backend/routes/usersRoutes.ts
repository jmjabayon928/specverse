// src/backend/routes/usersRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import {
  getUsers,      // legacy /users
  listUsers,     // new paged list
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/usersController'

const router = Router()

// Legacy route: now also protected by auth
router.get('/users', verifyToken, getUsers)

// Newer settings API (mounted under /api/backend/settings/users)
router.get('/', verifyToken, listUsers)
router.get('/:id', verifyToken, getUser)
router.post('/', verifyToken, createUser)
router.patch('/:id', verifyToken, updateUser)
router.delete('/:id', verifyToken, deleteUser)

export default router

// src/backend/routes/permissionsRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import {
  listPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission,
} from '../controllers/permissionsController'

const router = Router()

// List permissions with optional paging/search
router.get('/', verifyToken, listPermissions)

// Get a single permission by id
router.get('/:id', verifyToken, getPermission)

// Create permission
router.post('/', verifyToken, createPermission)

// Update permission
router.patch('/:id', verifyToken, updatePermission)

// Delete permission
router.delete('/:id', verifyToken, deletePermission)

export default router

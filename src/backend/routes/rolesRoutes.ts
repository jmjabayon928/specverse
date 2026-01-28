// src/backend/routes/rolesRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  getRolePermissions,
  getRoleAvailablePermissions,
  addPermissionToRole,
  removePermissionFromRole,
} from '../controllers/rolesController'

const router = Router()

// All role routes require a valid session
router.get('/', verifyToken, listRoles)
router.get('/:id', verifyToken, getRole)

router.get('/:id/permissions', verifyToken, getRolePermissions)
router.get('/:id/permissions/available', verifyToken, getRoleAvailablePermissions)

router.post('/:id/permissions', verifyToken, addPermissionToRole)
router.delete('/:id/permissions/:permissionId', verifyToken, removePermissionFromRole)

router.post('/', verifyToken, createRole)
router.patch('/:id', verifyToken, updateRole)
router.delete('/:id', verifyToken, deleteRole)

export default router

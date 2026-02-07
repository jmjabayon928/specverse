// src/backend/routes/rolesRoutes.ts
import { Router } from 'express'
import { verifyToken, requirePermission } from '../middleware/authMiddleware'
import { PERMISSIONS } from '@/constants/permissions'
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

// All role routes require a valid session; READ = ACCOUNT_VIEW, MUTATE = ACCOUNT_ROLE_MANAGE
router.get('/', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_VIEW), listRoles)
router.get('/:id', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_VIEW), getRole)

router.get('/:id/permissions', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_VIEW), getRolePermissions)
router.get('/:id/permissions/available', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_VIEW), getRoleAvailablePermissions)

router.post('/:id/permissions', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_ROLE_MANAGE), addPermissionToRole)
router.delete('/:id/permissions/:permissionId', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_ROLE_MANAGE), removePermissionFromRole)

router.post('/', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_ROLE_MANAGE), createRole)
router.patch('/:id', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_ROLE_MANAGE), updateRole)
router.delete('/:id', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_ROLE_MANAGE), deleteRole)

export default router

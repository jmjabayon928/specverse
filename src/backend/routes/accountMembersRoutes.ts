// src/backend/routes/accountMembersRoutes.ts
import { Router } from 'express'
import { verifyToken, requirePermission } from '../middleware/authMiddleware'
import {
  listMembers,
  updateRole,
  updateStatus,
} from '../controllers/accountMembersController'
import { PERMISSIONS } from '@/constants/permissions'

const router = Router()

router.get('/', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_VIEW), listMembers)
router.patch(
  '/:id/role',
  verifyToken,
  requirePermission(PERMISSIONS.ACCOUNT_ROLE_MANAGE),
  updateRole,
)
router.patch(
  '/:id/status',
  verifyToken,
  requirePermission(PERMISSIONS.ACCOUNT_USER_MANAGE),
  updateStatus,
)

export default router

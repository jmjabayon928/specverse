// src/backend/routes/rolesListRoutes.ts
import { Router } from 'express'
import { verifyToken, requirePermission } from '../middleware/authMiddleware'
import { listRolesForDropdown } from '../controllers/rolesController'
import { PERMISSIONS } from '@/constants/permissions'

const router = Router()

router.get('/', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_VIEW), listRolesForDropdown)

export default router

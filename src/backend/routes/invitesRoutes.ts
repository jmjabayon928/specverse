// src/backend/routes/invitesRoutes.ts
import { Router } from 'express'
import { verifyToken, verifyTokenOnly, optionalVerifyToken, requirePermission } from '../middleware/authMiddleware'
import {
  create,
  list,
  resend,
  revoke,
  byToken,
  accept,
  acceptPublic,
  decline,
} from '../controllers/invitesController'
import { PERMISSIONS } from '@/constants/permissions'

const router = Router()

// Public: by-token (no auth)
router.get('/by-token', byToken)

// Accept requires auth only (no account context; user may have no account yet)
router.post('/accept', verifyTokenOnly, accept)

// Public: accept with token + firstName, lastName, password (create or reactivate user)
router.post('/accept-public', acceptPublic)

// Decline: auth optional (so we can set performedBy when logged in)
router.post('/decline', optionalVerifyToken, decline)

// All below: verifyToken + account context + ACCOUNT_USER_MANAGE
router.get('/', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_USER_MANAGE), list)
router.post('/', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_USER_MANAGE), create)
router.post('/:id/resend', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_USER_MANAGE), resend)
router.post('/:id/revoke', verifyToken, requirePermission(PERMISSIONS.ACCOUNT_USER_MANAGE), revoke)

export default router

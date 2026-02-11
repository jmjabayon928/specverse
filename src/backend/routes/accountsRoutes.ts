// src/backend/routes/accountsRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import { requireAdmin } from '../middleware/requireAdmin'
import { createAccount, getAccountById, listAccounts, updateAccount } from '../controllers/accountsController'

const router = Router()

router.get('/', verifyToken, requireAdmin, listAccounts)
router.get('/mine', verifyToken, listAccounts)
router.get('/:id', verifyToken, requireAdmin, getAccountById)
router.post('/', verifyToken, requireAdmin, createAccount)
router.patch('/:id', verifyToken, requireAdmin, updateAccount)

export default router

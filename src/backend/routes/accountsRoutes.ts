// src/backend/routes/accountsRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import { listAccounts } from '../controllers/accountsController'

const router = Router()

router.get('/', verifyToken, listAccounts)

export default router

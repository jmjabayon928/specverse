// src/backend/routes/sessionsRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import { setActiveAccount } from '../controllers/sessionsController'

const router = Router()

router.post('/active-account', verifyToken, setActiveAccount)

export default router

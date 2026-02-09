import { Router } from 'express'
import { verifyToken, requireOwner } from '../middleware/authMiddleware'
import {
  patchStatus,
  postTransferOwnership,
  deleteAccount,
} from '../controllers/accountGovernanceController'

const router = Router()

router.patch('/status', verifyToken, requireOwner, patchStatus)
router.post('/transfer-ownership', verifyToken, requireOwner, postTransferOwnership)
router.delete('/', verifyToken, requireOwner, deleteAccount)

export default router

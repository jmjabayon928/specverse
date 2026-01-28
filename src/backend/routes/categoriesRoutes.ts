// src/backend/routes/categoriesRoutes.ts
import { Router } from 'express'
import { verifyToken } from '../middleware/authMiddleware'
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/categoriesController'

const router = Router()

router.get('/', verifyToken, listCategories)
router.get('/:id', verifyToken, getCategory)
router.post('/', verifyToken, createCategory)
router.patch('/:id', verifyToken, updateCategory)
router.delete('/:id', verifyToken, deleteCategory)

export default router

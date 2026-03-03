// src/backend/routes/importsRoutes.ts
import { Router, type RequestHandler } from 'express'
import multer from 'multer'
import path from 'path'
import { verifyToken } from '../middleware/authMiddleware'
import {
  previewImportHandler,
  runImportHandler,
} from '../controllers/importsController'

const wrapAsync = (fn: RequestHandler): RequestHandler => (req, res, next) => {
  void Promise.resolve(fn(req, res, next)).catch(next)
}

const router = Router()

// Local disk tmp for uploads (same pattern as mirrorRoutes)
const upload = multer({ dest: path.join(process.cwd(), 'tmp_uploads') })

// POST /api/backend/imports/preview — preview import file
router.post(
  '/preview',
  verifyToken,
  upload.single('file'),
  wrapAsync(previewImportHandler)
)

// POST /api/backend/imports/run — run import job
router.post(
  '/run',
  verifyToken,
  wrapAsync(runImportHandler)
)

export default router

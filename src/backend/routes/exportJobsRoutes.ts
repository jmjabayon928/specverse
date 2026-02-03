// src/backend/routes/exportJobsRoutes.ts
import type { Request, Response, NextFunction } from 'express'
import { Router } from 'express'
import { verifyToken, optionalVerifyToken, requirePermission } from '../middleware/authMiddleware'
import { requireAdmin } from '../middleware/requireAdmin'
import { asyncHandler } from '../utils/asyncHandler'
import {
  startExportJobHandler,
  getExportJobStatusHandler,
  downloadExportJobHandler,
  getDownloadUrlHandler,
  cancelExportJobHandler,
  retryExportJobHandler,
  cleanupExportJobsHandler,
} from '../controllers/exportJobsController'

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>

const router = Router()

// POST /api/backend/exports/jobs — start export (verifyToken + INVENTORY_VIEW for pilot)
router.post(
  '/',
  verifyToken,
  requirePermission('INVENTORY_VIEW'),
  asyncHandler(startExportJobHandler as AsyncRequestHandler)
)

// POST /api/backend/exports/jobs/cleanup — delete expired files (admin only; must be before /:jobId)
router.post(
  '/cleanup',
  verifyToken,
  requireAdmin,
  asyncHandler(cleanupExportJobsHandler as AsyncRequestHandler)
)

// GET /api/backend/exports/jobs/:jobId — job status (owner or admin)
router.get(
  '/:jobId',
  verifyToken,
  asyncHandler(getExportJobStatusHandler as AsyncRequestHandler)
)

// GET /api/backend/exports/jobs/:jobId/download — stream file (token query or session; owner/admin)
router.get(
  '/:jobId/download',
  optionalVerifyToken,
  asyncHandler(downloadExportJobHandler as AsyncRequestHandler)
)

// GET /api/backend/exports/jobs/:jobId/download-url — return signed URL (owner/admin)
router.get(
  '/:jobId/download-url',
  verifyToken,
  asyncHandler(getDownloadUrlHandler as AsyncRequestHandler)
)

// POST /api/backend/exports/jobs/:jobId/cancel — cancel queued/running (owner/admin)
router.post(
  '/:jobId/cancel',
  verifyToken,
  asyncHandler(cancelExportJobHandler as AsyncRequestHandler)
)

// POST /api/backend/exports/jobs/:jobId/retry — retry failed job (owner/admin)
router.post(
  '/:jobId/retry',
  verifyToken,
  asyncHandler(retryExportJobHandler as AsyncRequestHandler)
)

export default router

import { Router, type Request, type Response, type NextFunction } from 'express'
import { verifyToken, requirePermission } from '@/backend/middleware/authMiddleware'
import { uploadAttachment } from '@/backend/utils/attachmentUpload'
import {
  cloneChecklistTemplateHandler,
  createChecklistRunHandler,
  getChecklistRunHandler,
  patchChecklistRunEntryHandler,
  patchChecklistRunHandler,
  uploadChecklistEvidenceHandler,
} from '@/backend/controllers/checklistsController'

const router = Router()

const PERMISSIONS = {
  CHECKLISTS_RUN_CREATE: 'CHECKLISTS_RUN_CREATE',
  CHECKLISTS_RUN_VIEW: 'CHECKLISTS_RUN_VIEW',
  CHECKLISTS_RUN_EXECUTE: 'CHECKLISTS_RUN_EXECUTE',
  CHECKLISTS_EVIDENCE_UPLOAD: 'CHECKLISTS_EVIDENCE_UPLOAD',
  CHECKLISTS_TEMPLATE_CLONE: 'CHECKLISTS_TEMPLATE_CLONE',
  CHECKLISTS_RUN_UPDATE: 'CHECKLISTS_RUN_UPDATE',
} as const

interface RateLimitBucket {
  windowStartMs: number
  count: number
}

const checklistEvidenceBuckets = new Map<string, RateLimitBucket>()

const getChecklistEvidenceRateLimitConfig = (): { limit: number; windowMs: number } => {
  const limitEnv = process.env.CHECKLIST_EVIDENCE_RL_LIMIT
  const windowEnv = process.env.CHECKLIST_EVIDENCE_RL_WINDOW_SEC

  let limit = 20
  let windowSec = 60

  if (typeof limitEnv === 'string' && limitEnv.trim().length > 0) {
    const parsed = Number.parseInt(limitEnv, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = parsed
    }
  }

  if (typeof windowEnv === 'string' && windowEnv.trim().length > 0) {
    const parsed = Number.parseInt(windowEnv, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      windowSec = parsed
    }
  }

  return {
    limit,
    windowMs: windowSec * 1000,
  }
}

const getChecklistEvidenceRateLimitKey = (req: Request): string => {
  const maybeUser = (req as Request & { user?: unknown }).user

  if (maybeUser && typeof maybeUser === 'object') {
    const candidate = maybeUser as { accountId?: unknown }
    if (typeof candidate.accountId === 'number' && Number.isFinite(candidate.accountId)) {
      return `acct:${candidate.accountId}`
    }
  }

  const ip = typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : 'unknown'
  return `ip:${ip}`
}

const rateLimitChecklistEvidence = (req: Request, res: Response, next: NextFunction): void => {
  const { limit, windowMs } = getChecklistEvidenceRateLimitConfig()
  const key = getChecklistEvidenceRateLimitKey(req)
  const now = Date.now()

  const existing = checklistEvidenceBuckets.get(key)

  if (!existing || now - existing.windowStartMs >= windowMs) {
    checklistEvidenceBuckets.set(key, { windowStartMs: now, count: 1 })
    next()
    return
  }

  if (existing.count < limit) {
    existing.count += 1
    next()
    return
  }

  const elapsed = now - existing.windowStartMs
  const remainingMs = windowMs - elapsed
  const remainingSec = remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 1

  res.setHeader('Retry-After', String(remainingSec))
  res.status(429).json({
    message: 'Too many uploads. Please try again later.',
  })
}

router.post(
  '/run',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_RUN_CREATE),
  createChecklistRunHandler,
)

router.get(
  '/runs/:runId',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_RUN_VIEW),
  getChecklistRunHandler,
)

router.patch(
  '/run-entries/:runEntryId',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_RUN_EXECUTE),
  patchChecklistRunEntryHandler,
)

router.post(
  '/run-entries/:runEntryId/evidence',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_EVIDENCE_UPLOAD),
  rateLimitChecklistEvidence,
  uploadAttachment.single('file'),
  uploadChecklistEvidenceHandler,
)

router.post(
  '/templates/:id/clone',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_TEMPLATE_CLONE),
  cloneChecklistTemplateHandler,
)

router.patch(
  '/runs/:runId',
  verifyToken,
  requirePermission(PERMISSIONS.CHECKLISTS_RUN_UPDATE),
  patchChecklistRunHandler,
)

export default router

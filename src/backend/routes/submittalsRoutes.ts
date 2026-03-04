import { Router } from 'express'
import { z } from 'zod'
import { verifyToken, requirePermission } from '../middleware/authMiddleware'
import { mustGetAccountId } from '../utils/authGuards'
import { AppError } from '../errors/AppError'
import {
  createSubmittal as serviceCreateSubmittal,
  getSubmittalById as serviceGetSubmittalById,
  listSubmittals as serviceListSubmittals,
  updateSubmittal as serviceUpdateSubmittal,
  transitionSubmittal as serviceTransitionSubmittal,
} from '../services/submittalsService'

const SUBMITTALS_READ = 'submittals.read'
const SUBMITTALS_CREATE = 'submittals.create'
const SUBMITTALS_UPDATE = 'submittals.update'
const SUBMITTALS_TRANSITION = 'submittals.transition'

const router = Router()

const querySchema = z.object({
  page: z.string().optional().transform(s => (s ? Number(s) : 1)).pipe(z.number().int().min(1).optional()),
  pageSize: z.string().optional().transform(s => (s ? Number(s) : 20)).pipe(z.number().int().min(1).max(100).optional()),
  lifecycleStateId: z.string().optional().transform(s => (s ? Number(s) : undefined)).pipe(z.number().int().positive().optional()),
  projectId: z.string().optional().transform(s => (s ? Number(s) : undefined)).pipe(z.number().int().positive().optional()),
  clientId: z.string().optional().transform(s => (s ? Number(s) : undefined)).pipe(z.number().int().positive().optional()),
})
const paramsIdSchema = z.object({
  id: z.string().transform(s => Number(s)).pipe(z.number().int().positive()),
})
const createBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).nullable().optional(),
  projectId: z.number().int().positive().nullable().optional(),
  clientId: z.number().int().positive().nullable().optional(),
})
const updateBodySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
})
const transitionBodySchema = z.object({
  toCode: z.string().min(1).max(30),
  note: z.string().max(1000).nullable().optional(),
})

router.get('/', verifyToken, requirePermission(SUBMITTALS_READ), async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) throw new AppError('Invalid query parameters', 400)
    const page = parsed.data.page ?? 1
    const pageSize = parsed.data.pageSize ?? 20
    const result = await serviceListSubmittals(accountId, {
      page,
      pageSize,
      lifecycleStateId: parsed.data.lifecycleStateId ?? null,
      projectId: parsed.data.projectId ?? null,
      clientId: parsed.data.clientId ?? null,
    })
    res.status(200).json(result)
  } catch (e) {
    next(e)
  }
})

router.post('/', verifyToken, requirePermission(SUBMITTALS_CREATE), async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return
    const userId = req.user?.userId
    if (typeof userId !== 'number') throw new AppError('Unauthorized', 401)
    const parsed = createBodySchema.safeParse(req.body)
    if (!parsed.success) throw new AppError('Invalid body', 400)
    const input = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      projectId: parsed.data.projectId ?? null,
      clientId: parsed.data.clientId ?? null,
    }
    const row = await serviceCreateSubmittal(accountId, userId, input)
    res.status(201).json(row)
  } catch (e) {
    next(e)
  }
})

router.get('/:id', verifyToken, requirePermission(SUBMITTALS_READ), async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return
    const parsed = paramsIdSchema.safeParse(req.params)
    if (!parsed.success) throw new AppError('Invalid id', 400)
    const row = await serviceGetSubmittalById(accountId, parsed.data.id)
    if (row == null) throw new AppError('Submittal not found', 404)
    res.status(200).json(row)
  } catch (e) {
    next(e)
  }
})

router.patch('/:id', verifyToken, requirePermission(SUBMITTALS_UPDATE), async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return
    const userId = req.user?.userId
    if (typeof userId !== 'number') throw new AppError('Unauthorized', 401)
    const parsedParams = paramsIdSchema.safeParse(req.params)
    if (!parsedParams.success) throw new AppError('Invalid id', 400)
    const parsedBody = updateBodySchema.safeParse(req.body)
    if (!parsedBody.success) throw new AppError('Invalid body', 400)
    const row = await serviceUpdateSubmittal(accountId, userId, parsedParams.data.id, {
      title: parsedBody.data.title,
      description: parsedBody.data.description,
    })
    if (row == null) throw new AppError('Submittal not found', 404)
    res.status(200).json(row)
  } catch (e) {
    next(e)
  }
})

router.post('/:id/transition', verifyToken, requirePermission(SUBMITTALS_TRANSITION), async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (accountId == null) return
    const userId = req.user?.userId
    if (typeof userId !== 'number') throw new AppError('Unauthorized', 401)
    const parsedParams = paramsIdSchema.safeParse(req.params)
    if (!parsedParams.success) throw new AppError('Invalid id', 400)
    const parsedBody = transitionBodySchema.safeParse(req.body)
    if (!parsedBody.success) throw new AppError('Invalid body', 400)
    const row = await serviceTransitionSubmittal(
      accountId,
      userId,
      parsedParams.data.id,
      parsedBody.data.toCode,
      parsedBody.data.note ?? null
    )
    if (row == null) throw new AppError('Submittal not found', 404)
    res.status(200).json(row)
  } catch (e) {
    next(e)
  }
})

export default router

// src/backend/controllers/projectsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listProjects as listProjectsService,
  getProjectById as getProjectByIdService,
  createProject as createProjectService,
  updateProject as updateProjectService,
  deleteProject as deleteProjectService,
  fetchProjectOptions as fetchProjectOptionsService,
  type ListProjectsResult,
  type ListProjectsParams,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '../services/projectsService'

// ----------------------------- Zod Schemas -----------------------------

const projectCreateSchema = z.object({
  ClientID: z.number().int().positive('ClientID is required'),
  ClientProjNum: z
    .string()
    .trim()
    .min(1, 'ClientProjNum is required')
    .max(15, 'ClientProjNum must be ≤ 15 chars'),
  ProjNum: z
    .string()
    .trim()
    .min(1, 'ProjNum is required')
    .max(15, 'ProjNum must be ≤ 15 chars'),
  ProjName: z
    .string()
    .trim()
    .min(1, 'ProjName is required')
    .max(255, 'ProjName too long'),
  ProjDesc: z
    .string()
    .trim()
    .min(1, 'ProjDesc is required')
    .max(255, 'ProjDesc too long'),
  ManagerID: z.number().int().positive('ManagerID is required'),
  StartDate: z.string().min(1, 'StartDate is required'),
  EndDate: z.string().nullable().optional(),
})

const projectUpdateSchema = projectCreateSchema.partial()

type ProjectCreateBody = z.infer<typeof projectCreateSchema>
type ProjectUpdateBody = z.infer<typeof projectUpdateSchema>

// --------------------------- Helper functions --------------------------

const qstr = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0]
  }

  return fallback
}

const qint = (value: unknown, fallback: number): number => {
  const asString = qstr(value, String(fallback))
  const parsed = Number.parseInt(asString, 10)

  if (Number.isFinite(parsed)) {
    return parsed
  }

  return fallback
}

const firstIssueMessage = (result: z.SafeParseError<unknown>): string => {
  const issue = result.error.issues[0]

  if (issue && issue.message) {
    return issue.message
  }

  return 'Invalid project payload'
}

const buildUpdatePayload = (body: ProjectUpdateBody): UpdateProjectInput => {
  const payload: UpdateProjectInput = {}

  const keys = Object.keys(body) as (keyof ProjectUpdateBody)[]

  for (const key of keys) {
    const value = body[key]

    if (value === undefined) {
      continue
    }

    if (typeof value === 'string') {
      ;(payload as Record<string, unknown>)[key] = value.trim()
      continue
    }

    ;(payload as Record<string, unknown>)[key] = value
  }

  return payload
}

const ensureHasUpdatableFields = (payload: UpdateProjectInput): void => {
  if (Object.keys(payload).length > 0) {
    return
  }

  throw new AppError('No updatable fields provided', 400)
}

// ----------------------------- List / Get ------------------------------

/** GET /api/backend/settings/projects */
export const listProjects: RequestHandler = async (req, res, next) => {
  try {
    const page = Math.max(qint(req.query.page, 1), 1)
    const pageSize = Math.min(Math.max(qint(req.query.pageSize, 20), 1), 100)
    const search = qstr(req.query.search, '').trim()

    const params: ListProjectsParams = {
      page,
      pageSize,
      search,
    }

    const result: ListProjectsResult = await listProjectsService(params)

    res.status(200).json(result)
  } catch (error) {
    console.error('listProjects error:', error)
    next(new AppError('Failed to fetch projects', 500))
  }
}

/** GET /api/backend/settings/projects/:id */
export const getProject: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id)) {
      throw new AppError('Invalid id', 400)
    }

    const row = await getProjectByIdService(id)

    if (!row) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json(row)
  } catch (error) {
    console.error('getProject error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to fetch project', 500))
  }
}

// ----------------------------- Create ---------------------------------

/** POST /api/backend/settings/projects */
export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const parsed = projectCreateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message, 400)
    }

    const body: ProjectCreateBody = parsed.data

    const input: CreateProjectInput = {
      ClientID: body.ClientID,
      ClientProjNum: body.ClientProjNum.trim(),
      ProjNum: body.ProjNum.trim(),
      ProjName: body.ProjName.trim(),
      ProjDesc: body.ProjDesc.trim(),
      ManagerID: body.ManagerID,
      StartDate: body.StartDate,
      EndDate: body.EndDate ?? null,
    }

    const created = await createProjectService(input)

    res.status(201).json(created)
  } catch (error) {
    // no unique constraints were clearly surfaced in the original,
    // so we only send a generic failure here
    console.error('createProject error:', error)
    next(new AppError('Failed to create project', 500))
  }
}

// ----------------------------- Update ---------------------------------

/** PATCH /api/backend/settings/projects/:id */
export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id)) {
      throw new AppError('Invalid id', 400)
    }

    const parsed = projectUpdateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      const message = firstIssueMessage(parsed)
      throw new AppError(message, 400)
    }

    const payload = buildUpdatePayload(parsed.data)
    ensureHasUpdatableFields(payload)

    // keep the semantic behavior: length constraints (≤ 15, ≤ 255) are already enforced via Zod

    const updated = await updateProjectService(id, payload)

    if (!updated) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json(updated)
  } catch (error) {
    console.error('updateProject error:', error)
    next(new AppError('Failed to update project', 500))
  }
}

// ----------------------------- Delete ---------------------------------

/** DELETE /api/backend/settings/projects/:id */
export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    const id = Number(req.params.id)

    if (!Number.isFinite(id)) {
      throw new AppError('Invalid id', 400)
    }

    const ok = await deleteProjectService(id)

    if (!ok) {
      throw new AppError('Not found', 404)
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('deleteProject error:', error)

    if (error instanceof AppError) {
      next(error)
      return
    }

    next(new AppError('Failed to delete project', 500))
  }
}

// --------------------------- Options (clients + managers) --------------

/** GET /api/backend/settings/projects/options */
export const getProjectOptions: RequestHandler = async (_req, res, next) => {
  try {
    const result = await fetchProjectOptionsService()
    res.status(200).json(result)
  } catch (error) {
    console.error('getProjectOptions error:', error)
    next(new AppError('Failed to fetch project options', 500))
  }
}

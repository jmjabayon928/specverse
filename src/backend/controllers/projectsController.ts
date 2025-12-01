import type { RequestHandler } from 'express'
import { z } from 'zod'
import {
  listProjects as svcList,
  getProjectById as svcGet,
  createProject as svcCreate,
  updateProject as svcUpdate,
  deleteProject as svcDelete,
  fetchProjectOptions as svcOptions,
} from '../services/projectsService'
import { AppError } from '../errors/AppError'

const projectIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const listProjectsQuerySchema = z.object({
  page: z
    .coerce
    .number()
    .int()
    .positive()
    .default(1),
  pageSize: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  search: z
    .string()
    .trim()
    .max(255)
    .optional()
    .default(''),
})

const createProjectBodySchema = z.object({
  ClientID: z.coerce.number().int().positive(),
  ManagerID: z.coerce.number().int().positive(),
  ClientProjNum: z
    .string()
    .trim()
    .min(1)
    .max(15),
  ProjNum: z
    .string()
    .trim()
    .min(1)
    .max(15),
  ProjName: z
    .string()
    .trim()
    .min(1)
    .max(255),
  ProjDesc: z
    .string()
    .trim()
    .max(255)
    .optional()
    .default(''),
  StartDate: z
    .string()
    .trim()
    .min(1),
  EndDate: z
    .string()
    .trim()
    .min(1)
    .optional()
    .nullable(),
})

const updateProjectBodySchema = createProjectBodySchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required to update a project',
  })

const parseProjectId = (rawId: unknown): number => {
  const result = projectIdParamSchema.safeParse({ id: rawId })

  if (!result.success) {
    throw new AppError('Invalid project id', 400)
  }

  return result.data.id
}

/** GET /api/backend/settings/projects */
export const listProjects: RequestHandler = async (req, res, next) => {
  try {
    const parsed = listProjectsQuerySchema.safeParse(req.query)

    if (!parsed.success) {
      throw new AppError('Invalid project filter parameters', 400)
    }

    const out = await svcList(parsed.data)

    res.json(out)
  } catch (error) {
    next(error)
  }
}

/** GET /api/backend/settings/projects/options */
export const getProjectOptions: RequestHandler = async (_req, res, next) => {
  try {
    const opts = await svcOptions()

    res.json(opts)
  } catch (error) {
    next(error)
  }
}

/** GET /api/backend/settings/projects/:id */
export const getProject: RequestHandler = async (req, res, next) => {
  try {
    const id = parseProjectId(req.params.id)

    const row = await svcGet(id)

    if (!row) {
      throw new AppError('Project not found', 404)
    }

    res.json(row)
  } catch (error) {
    next(error)
  }
}

/** POST /api/backend/settings/projects */
export const createProject: RequestHandler = async (req, res, next) => {
  try {
    const parsed = createProjectBodySchema.safeParse(req.body)

    if (!parsed.success) {
      throw new AppError('Invalid project payload', 400)
    }

    const body = parsed.data

    const newId = await svcCreate({
      ClientID: body.ClientID,
      ManagerID: body.ManagerID,
      ClientProjNum: body.ClientProjNum,
      ProjNum: body.ProjNum,
      ProjName: body.ProjName,
      ProjDesc: body.ProjDesc,
      StartDate: body.StartDate,
      EndDate: body.EndDate ?? null,
    })

    res.status(201).json({ ProjectID: newId })
  } catch (error) {
    next(error)
  }
}

/** PATCH /api/backend/settings/projects/:id */
export const updateProject: RequestHandler = async (req, res, next) => {
  try {
    const id = parseProjectId(req.params.id)

    const parsed = updateProjectBodySchema.safeParse(req.body)

    if (!parsed.success) {
      throw new AppError('Invalid project payload', 400)
    }

    const body = parsed.data

    const updateInput: {
      ClientID?: number
      ManagerID?: number
      ClientProjNum?: string
      ProjNum?: string
      ProjName?: string
      ProjDesc?: string
      StartDate?: string
      EndDate?: string | null
    } = {}

    if (typeof body.ClientID === 'number') {
      updateInput.ClientID = body.ClientID
    }

    if (typeof body.ManagerID === 'number') {
      updateInput.ManagerID = body.ManagerID
    }

    if (typeof body.ClientProjNum === 'string') {
      updateInput.ClientProjNum = body.ClientProjNum
    }

    if (typeof body.ProjNum === 'string') {
      updateInput.ProjNum = body.ProjNum
    }

    if (typeof body.ProjName === 'string') {
      updateInput.ProjName = body.ProjName
    }

    if (typeof body.ProjDesc === 'string') {
      updateInput.ProjDesc = body.ProjDesc
    }

    if (typeof body.StartDate === 'string') {
      updateInput.StartDate = body.StartDate
    }

    if ('EndDate' in body) {
      updateInput.EndDate = body.EndDate ?? null
    }

    const updated = await svcUpdate(id, updateInput)

    if (!updated) {
      throw new AppError('Project not found', 404)
    }

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

/** DELETE /api/backend/settings/projects/:id */
export const deleteProject: RequestHandler = async (req, res, next) => {
  try {
    const id = parseProjectId(req.params.id)

    const deleted = await svcDelete(id)

    if (!deleted) {
      throw new AppError('Project not found', 404)
    }

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
}

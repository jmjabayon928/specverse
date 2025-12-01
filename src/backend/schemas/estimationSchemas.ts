// src/backend/schemas/estimationSchemas.ts
import { z } from 'zod'

export const estimationIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
})

export type EstimationIdParams = z.infer<typeof estimationIdParamSchema>

export const createEstimationBodySchema = z.object({
  ProjectID: z.coerce.number().int().positive(),
  Title: z.string().trim().min(1, 'Title is required'),
  Description: z.string().trim().optional()
})

export type CreateEstimationBody = z.infer<typeof createEstimationBodySchema>

export const updateEstimationBodySchema = z.object({
  ProjectID: z.coerce.number().int().positive(),
  Title: z.string().trim().min(1, 'Title is required'),
  Description: z.string().trim().optional()
})

export type UpdateEstimationBody = z.infer<typeof updateEstimationBodySchema>

export const filterEstimationsBodySchema = z.object({
  statuses: z.array(z.string().trim()).default([]),
  clients: z.array(z.coerce.number().int().positive()).default([]),
  projects: z.array(z.coerce.number().int().positive()).default([]),
  search: z.string().trim().default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
})

export type FilterEstimationsBody = z.infer<typeof filterEstimationsBodySchema>

export const exportFilteredEstimationsBodySchema = filterEstimationsBodySchema.pick({
  statuses: true,
  clients: true,
  projects: true,
  search: true
})

export type ExportFilteredEstimationsBody = z.infer<
  typeof exportFilteredEstimationsBodySchema
>

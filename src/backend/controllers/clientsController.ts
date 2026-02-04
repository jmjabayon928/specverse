// src/backend/controllers/clientsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listClients,
  getClientById as getClientByIdService,
  createClient as createClientService,
  updateClient as updateClientService,
  deleteClient as deleteClientService,
  type ListClientsParams,
  type CreateClientInput,
  type UpdateClientInput,
  type ClientDTO,
} from '../services/clientsService'

type Paged<T> = {
  page: number
  pageSize: number
  total: number
  rows: T[]
}

// ----------------------------- Zod Schemas -----------------------------

const clientCreateSchema = z.object({
  ClientCode: z.string().trim().min(1, 'ClientCode is required'),
  ClientName: z.string().trim().min(1, 'ClientName is required'),
  ClientEmail: z.string().trim().min(1, 'ClientEmail is required'),
  ClientPhone: z.string().trim().min(1, 'ClientPhone is required'),
  ClientAddress: z.string().trim().min(1, 'ClientAddress is required'),
  ContactPerson: z.string().trim().min(1, 'ContactPerson is required'),
  ClientLogo: z.string().trim().min(1, 'ClientLogo is required'),
})

const clientUpdateSchema = clientCreateSchema.partial()

type ClientCreateBody = z.infer<typeof clientCreateSchema>
type ClientUpdateBody = z.infer<typeof clientUpdateSchema>

// ----------------------- Small helper utilities -----------------------

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

const normalizeNullable = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  return trimmed
}

const buildUpdatePayload = (body: ClientUpdateBody): UpdateClientInput => {
  const payload: UpdateClientInput = {}

  const keys = Object.keys(body) as (keyof ClientUpdateBody)[]

  for (const key of keys) {
    const castKey = key as keyof UpdateClientInput
    const raw = body[castKey]
    const normalized = normalizeNullable(raw)

    if (normalized !== null) {
      payload[castKey] = normalized
      continue
    }

    payload[castKey] = null
  }

  return payload
}

const ensureHasUpdatableFields = (payload: UpdateClientInput): void => {
  if (Object.keys(payload).length > 0) {
    return
  }

  throw new AppError('No updatable fields provided', 400)
}

// ----------------------------- List / Get -----------------------------

export const getClients: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const page = Math.max(qint(req.query.page, 1), 1)
    const pageSize = Math.min(Math.max(qint(req.query.pageSize, 20), 1), 100)
    const search = qstr(req.query.search, '').trim()

    const params: ListClientsParams = {
      accountId,
      page,
      pageSize,
      search,
    }

    const result = await listClients(params)

    const payload: Paged<ClientDTO> = {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      rows: result.rows,
    }

    res.status(200).json(payload)
  } catch (error) {
    next(error)
  }
}

export const getClientById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid client id', 400);
    }

    const client = await getClientByIdService(accountId, id)

    if (!client) {
      throw new AppError('Client not found', 404)
    }

    res.status(200).json(client)
  } catch (error) {
    next(error)
  }
}

/* ----------------------------- Create ----------------------------- */

export const createClient: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const parsed = clientCreateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      throw new AppError('Invalid client payload', 400)
    }

    const body: ClientCreateBody = parsed.data

    const input: CreateClientInput = {
      ClientCode: body.ClientCode.trim(),
      ClientName: body.ClientName.trim(),
      ClientEmail: body.ClientEmail.trim(),
      ClientPhone: body.ClientPhone.trim(),
      ClientAddress: body.ClientAddress.trim(),
      ContactPerson: body.ContactPerson.trim(),
      ClientLogo: body.ClientLogo.trim(),
    }

    const id = await createClientService(accountId, input)
    const created = await getClientByIdService(accountId, id)

    if (!created) {
      throw new AppError('Client was created but could not be loaded', 500)
    }

    res.status(201).json(created)
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIENTCODE_CONFLICT') {
      next(new AppError('ClientCode already exists', 409))
      return
    }

    next(error)
  }
}

/* ----------------------------- Update ----------------------------- */

export const updateClient: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid client id', 400)
    }

    const parsed = clientUpdateSchema.safeParse(req.body ?? {})

    if (!parsed.success) {
      throw new AppError('Invalid client payload', 400)
    }

    const payload = buildUpdatePayload(parsed.data)
    ensureHasUpdatableFields(payload)

    const updated = await updateClientService(accountId, id, payload)

    if (!updated) {
      throw new AppError('Client not found', 404)
    }

    const row = await getClientByIdService(accountId, id)

    if (!row) {
      throw new AppError('Client not found', 404)
    }

    res.status(200).json(row)
  } catch (error) {
    if (error instanceof Error && error.name === 'CLIENTCODE_CONFLICT') {
      next(new AppError('ClientCode already exists', 409))
      return
    }

    next(error)
  }
}

/* ----------------------------- Delete ----------------------------- */

export const deleteClient: RequestHandler = async (req, res, next) => {
  try {
    const accountId = req.user?.accountId
    if (!accountId) {
      throw new AppError('Missing account context', 403)
    }

    const id = Number(req.params.id)

    if (!Number.isFinite(id) || id <= 0) {
      throw new AppError('Invalid client id', 400)
    }

    const deleted = await deleteClientService(accountId, id)

    if (!deleted) {
      throw new AppError('Client not found', 404)
    }

    res.status(200).json({ success: true })
  } catch (error) {
    next(error)
  }
}

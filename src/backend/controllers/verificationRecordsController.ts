// src/backend/controllers/verificationRecordsController.ts
import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../errors/AppError'
import {
  listForAccount,
  getById,
  listForSheet,
  create,
  linkToSheet,
  unlinkFromSheet,
  attachEvidence,
  listAttachments,
  listActiveTypes,
} from '../services/verificationRecordsService'
import { mustGetAccountId } from '@/backend/utils/authGuards'
import type { CreateVerificationRecordDto } from '@/domain/verification/verificationTypes'

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') {
    return null
  }
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}

function qint(value: unknown, fallback: number): number {
  const asString = typeof value === 'string' ? value : Array.isArray(value) ? value[0] : String(fallback)
  const parsed = Number.parseInt(asString, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const linkBodySchema = z.object({
  sheetId: z.number().int().positive(),
})

const unlinkBodySchema = z.object({
  sheetId: z.number().int().positive(),
})

const attachBodySchema = z.object({
  attachmentId: z.number().int().positive(),
})

const createBodySchema = z.object({
  verificationTypeId: z.number().int().positive(),
  result: z.string().min(1),
})

export const listVerificationRecords: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const limit = qint(req.query.limit, 100)
    const offset = qint(req.query.offset, 0)

    const records = await listForAccount(accountId, { limit, offset })
    res.status(200).json(records)
  } catch (error) {
    next(error)
  }
}

export const getVerificationRecordById: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid verification record id', 400)
    }

    const record = await getById(accountId, id)
    if (!record) {
      throw new AppError('Verification record not found', 404)
    }

    res.status(200).json(record)
  } catch (error) {
    next(error)
  }
}

export const listVerificationRecordsForSheet: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const sheetId = parseId(req.params.sheetId)
    if (!sheetId) {
      throw new AppError('Invalid sheet id', 400)
    }

    const records = await listForSheet(accountId, sheetId)
    res.status(200).json(records)
  } catch (error) {
    next(error)
  }
}

export const createVerificationRecord: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const parsed = createBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request payload', 400)
    }

    const input: CreateVerificationRecordDto = {
      accountId,
      verificationTypeId: parsed.data.verificationTypeId,
      result: parsed.data.result,
    }

    const record = await create(accountId, input)
    res.status(201).json(record)
  } catch (error) {
    next(error)
  }
}

export const linkVerificationRecordToSheet: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid verification record id', 400)
    }

    const parsed = linkBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request payload', 400)
    }

    const link = await linkToSheet(accountId, id, parsed.data.sheetId)
    res.status(200).json(link)
  } catch (error) {
    next(error)
  }
}

export const unlinkVerificationRecordFromSheet: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid verification record id', 400)
    }

    const parsed = unlinkBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request payload', 400)
    }

    const deleted = await unlinkFromSheet(accountId, id, parsed.data.sheetId)
    res.status(200).json({ deleted })
  } catch (error) {
    next(error)
  }
}

export const attachEvidenceToVerificationRecord: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid verification record id', 400)
    }

    const parsed = attachBodySchema.safeParse(req.body ?? {})
    if (!parsed.success) {
      throw new AppError('Invalid request payload', 400)
    }

    const attachment = await attachEvidence(accountId, id, parsed.data.attachmentId)
    res.status(200).json(attachment)
  } catch (error) {
    next(error)
  }
}

export const listVerificationRecordAttachments: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) {
      return
    }

    const id = parseId(req.params.id)
    if (!id) {
      throw new AppError('Invalid verification record id', 400)
    }

    const attachments = await listAttachments(accountId, id)
    res.status(200).json(attachments)
  } catch (error) {
    next(error)
  }
}

export const listVerificationRecordTypes: RequestHandler = async (_req, res, next) => {
  try {
    const types = await listActiveTypes()
    res.status(200).json(types)
  } catch (error) {
    next(error)
  }
}

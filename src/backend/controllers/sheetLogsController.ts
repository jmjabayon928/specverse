// src/backend/controllers/sheetLogsController.ts
import type { RequestHandler } from "express"
import {
  fetchSheetAuditLogs,
  fetchSheetChangeLogs,
  fetchSheetLogsMerged,
} from "../services/sheetLogsService"
import { sheetBelongsToAccount } from "../services/sheetAccessService"
import { mustGetAccountId } from '@/backend/utils/authGuards'
import { AppError } from "../errors/AppError"

function parseSheetId(raw: unknown): number | null {
  if (typeof raw !== "string") return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

function parseLimit(raw: unknown): number {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== "string") return 50
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) return 50
  return n
}

export const getSheetAuditLogs: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    if (sheetId == null) {
      res.status(400).json({ error: "Invalid sheetId" })
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const limit = parseLimit(req.query.limit)
    const items = await fetchSheetAuditLogs(sheetId, limit)
    res.json({ limit, items })
  } catch (err) {
    next(err)
  }
}

export const getSheetChangeLogs: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    if (sheetId == null) {
      res.status(400).json({ error: "Invalid sheetId" })
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const limit = parseLimit(req.query.limit)
    const items = await fetchSheetChangeLogs(sheetId, limit)
    res.json({ limit, items })
  } catch (err) {
    next(err)
  }
}

export const getSheetLogsMerged: RequestHandler = async (req, res, next) => {
  try {
    const sheetId = parseSheetId(req.params.sheetId)
    if (sheetId == null) {
      res.status(400).json({ error: "Invalid sheetId" })
      return
    }

    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const belongs = await sheetBelongsToAccount(sheetId, accountId)
    if (!belongs) {
      next(new AppError("Sheet not found", 404))
      return
    }

    const limit = parseLimit(req.query.limit)
    const items = await fetchSheetLogsMerged(sheetId, limit)
    res.json({ limit, items })
  } catch (err) {
    next(err)
  }
}


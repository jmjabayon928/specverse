// src/backend/controllers/instrumentLoopsController.ts
import type { RequestHandler } from 'express'
import { AppError } from '../errors/AppError'
import { listLoops, getLoopWithMembers } from '../services/instrumentLoopsService'
import { mustGetAccountId } from '@/backend/utils/authGuards'

function parseId(raw: string | string[] | undefined): number | null {
  if (typeof raw !== 'string') return null
  const parsed = Number.parseInt(raw, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return null
  return parsed
}

export const list: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const loops = await listLoops(accountId)
    res.status(200).json(loops)
  } catch (error) {
    next(error)
  }
}

export const getOne: RequestHandler = async (req, res, next) => {
  try {
    const accountId = mustGetAccountId(req, next)
    if (!accountId) return
    const loopId = parseId(req.params.loopId)
    if (!loopId) throw new AppError('Invalid loop id', 400)
    const loop = await getLoopWithMembers(accountId, loopId)
    res.status(200).json(loop)
  } catch (error) {
    next(error)
  }
}

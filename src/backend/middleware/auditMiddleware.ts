// src/backend/middleware/auditMiddleware.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { insertAuditLog } from '../database/auditQueries'

type AuditActionOptions = {
  tableName?: string | null
  recordIdParam?: string
}

function resolveRecordId(req: Request, recordIdParam: string | undefined): number | null {
  if (!recordIdParam) return null
  const raw = (req.params as Record<string, unknown> | undefined)?.[recordIdParam]
  if (typeof raw !== 'string') return null
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? n : null
}

export const auditAction = (action: string, options?: AuditActionOptions): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', async () => {
      const userId = req.user?.userId

      if (typeof userId !== 'number') {
        console.warn('⚠️ Cannot log audit: userId is missing or invalid')
        return
      }

      const status = res.statusCode
      const recordId = resolveRecordId(req, options?.recordIdParam)

      await insertAuditLog({
        Action: action,
        PerformedBy: userId,
        TableName: options?.tableName ?? null,
        RecordID: recordId,
        StatusCode: status,
        Route: req.originalUrl,
        Method: req.method,
        Changes: JSON.stringify(req.body ?? {}).slice(0, 1000),
      })
    })

    next()
  }
}

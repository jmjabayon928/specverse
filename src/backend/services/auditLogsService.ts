// src/backend/services/auditLogsService.ts
import {
  getAllAuditLogs,
  getAllAuditLogsCount,
  type GetAllAuditLogsFilters,
  type GetAllAuditLogsPagination,
} from '../database/auditQueries'
import { AppError } from '../errors/AppError'

export interface ListAuditLogsParams {
  page: number
  pageSize: number
  actorUserId?: number
  action?: string
  entityType?: string
  entityId?: number
  dateFrom?: string
  dateTo?: string
}

export interface AuditLogDTO {
  auditLogId: number
  entityType: string | null
  entityId: number | null
  action: string
  performedBy: number | null
  performedByName: string | null
  performedAt: string
  route: string | null
  method: string | null
  statusCode: number | null
  changes: unknown
  changesRaw: string | null
}

export interface ListAuditLogsResult {
  page: number
  pageSize: number
  total: number
  rows: AuditLogDTO[]
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function safeParseJSON(raw: unknown): { parsed: unknown; raw: string | null } {
  if (raw == null) return { parsed: null, raw: null }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return { parsed, raw }
    } catch {
      return { parsed: null, raw }
    }
  }
  // If already an object, return as-is
  return { parsed: raw, raw: typeof raw === 'string' ? raw : JSON.stringify(raw) }
}

function mapRowToDTO(row: Record<string, unknown>): AuditLogDTO {
  const auditLogId = toNumber(row.AuditLogID) ?? toNumber(row.LogID) ?? 0
  if (auditLogId === 0) {
    throw new AppError('Invalid audit log row: missing LogID/AuditLogID', 500)
  }
  const entityType = toString(row.TableName)
  const entityId = toNumber(row.RecordID)
  const action = toString(row.Action) ?? ''
  const performedBy = toNumber(row.PerformedBy) ?? toNumber(row.PerformedByUserID)
  const performedByName = toString(row.PerformedByName)
  const performedAt = toString(row.PerformedAtISO) ?? toString(row.PerformedAt) ?? ''
  const route = toString(row.Route)
  const method = toString(row.Method)
  const statusCode = toNumber(row.StatusCode)
  const { parsed: changes, raw: changesRaw } = safeParseJSON(row.Changes)

  return {
    auditLogId,
    entityType,
    entityId,
    action,
    performedBy,
    performedByName,
    performedAt,
    route,
    method,
    statusCode,
    changes,
    changesRaw,
  }
}

export async function listAuditLogs(
  params: ListAuditLogsParams
): Promise<ListAuditLogsResult> {
  const page = Math.max(1, params.page)
  const pageSize = Math.min(Math.max(1, params.pageSize), 100)

  const filters: GetAllAuditLogsFilters = {
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
  }

  const pagination: GetAllAuditLogsPagination = {
    page,
    pageSize,
  }

  const [rows, total] = await Promise.all([
    getAllAuditLogs(filters, pagination),
    getAllAuditLogsCount(filters),
  ])

  const dtos = (rows ?? []).map((row) => mapRowToDTO(row as Record<string, unknown>))

  return {
    page,
    pageSize,
    total,
    rows: dtos,
  }
}

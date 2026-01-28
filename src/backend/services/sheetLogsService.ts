// src/backend/services/sheetLogsService.ts
import { getAuditLogsForRecord } from "../database/auditQueries"
import { getChangeLogsForSheet } from "../database/changeLogQueries"

export type LogEntry = {
  id: number
  kind: "audit" | "change"
  sheetId: number
  action: string
  user: { id: number | null; name: string }
  timestamp: string
  details: Record<string, unknown>
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toString(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return ""
}

function pickId(row: Record<string, unknown>, candidates: string[]): number {
  for (const key of candidates) {
    const n = toNumber(row[key])
    if (typeof n === "number") return n
  }
  return 0
}

function safeTimestamp(raw: unknown): string {
  if (typeof raw === "string" && raw.trim() !== "") return raw
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString()
  return ""
}

export async function fetchSheetAuditLogs(
  sheetId: number,
  limit: number
): Promise<LogEntry[]> {
  const rows = (await getAuditLogsForRecord({
    tableName: "Sheets",
    recordId: sheetId,
    limit,
  })) as unknown[]

  return rows.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>

    const id = pickId(row, ["AuditLogID", "LogID", "ID"])
    const userId = toNumber(row.PerformedBy) ?? toNumber(row.PerformedByUserID)
    const userName =
      toString(row.PerformedByName) ||
      toString(row.PerformedByFullName) ||
      "Unknown"

    const timestamp =
      safeTimestamp(row.PerformedAtISO) || safeTimestamp(row.PerformedAt) || ""

    return {
      id,
      kind: "audit",
      sheetId,
      action: toString(row.Action) || "Audit",
      user: { id: userId, name: userName },
      timestamp,
      details: {
        tableName: row.TableName ?? null,
        recordId: row.RecordID ?? null,
        route: row.Route ?? null,
        method: row.Method ?? null,
        statusCode: row.StatusCode ?? null,
        changes: row.Changes ?? null,
      },
    } satisfies LogEntry
  })
}

export async function fetchSheetChangeLogs(
  sheetId: number,
  limit: number
): Promise<LogEntry[]> {
  const rows = (await getChangeLogsForSheet(sheetId, limit)) as unknown[]

  return rows.map((raw) => {
    const row = (raw ?? {}) as Record<string, unknown>

    const id = pickId(row, ["ChangeLogID", "LogID", "ID"])
    const userId = toNumber(row.ChangedBy) ?? toNumber(row.ChangedByUserID)
    const userName = toString(row.ChangedByName) || "Unknown"
    const timestamp =
      safeTimestamp(row.ChangeDateISO) || safeTimestamp(row.ChangeDate) || ""

    const fieldLabel = toString(row.FieldLabel) || "Field"
    const oldValue = toString(row.OldValue)
    const newValue = toString(row.NewValue)

    const action = `Field updated: ${fieldLabel} (${oldValue} → ${newValue})`

    return {
      id,
      kind: "change",
      sheetId,
      action,
      user: { id: userId, name: userName },
      timestamp,
      details: {
        infoTemplateId: row.InfoTemplateID ?? row.TemplateID ?? null,
        fieldLabel: row.FieldLabel ?? null,
        oldValue: row.OldValue ?? null,
        newValue: row.NewValue ?? null,
        uom: row.UOM ?? null,
      },
    } satisfies LogEntry
  })
}

export async function fetchSheetLogsMerged(
  sheetId: number,
  limit: number
): Promise<LogEntry[]> {
  const [audit, change] = await Promise.all([
    fetchSheetAuditLogs(sheetId, limit),
    fetchSheetChangeLogs(sheetId, limit),
  ])

  const merged = [...audit, ...change]

  merged.sort((a, b) => {
    const at = Date.parse(a.timestamp)
    const bt = Date.parse(b.timestamp)
    const aTime = Number.isNaN(at) ? 0 : at
    const bTime = Number.isNaN(bt) ? 0 : bt
    return bTime - aTime
  })

  return merged.slice(0, limit)
}


// src/backend/utils/logAuditAction.ts
import { insertAuditLog } from "@/backend/database/auditQueries";
import { redactChangesForLog } from "@/backend/utils/redact";

interface LogAuditInput {
  tableName?: string | null;
  recordId?: number | null;
  action: string;
  performedBy: number;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  changes?: Record<string, string | number | boolean | null> | null;
}

function safeSummary(input: LogAuditInput): Record<string, unknown> {
  return {
    tableName: input.tableName,
    recordId: input.recordId,
    action: input.action,
    performedBy: input.performedBy,
    route: input.route,
    method: input.method,
    statusCode: input.statusCode,
    changes: redactChangesForLog(input.changes ?? null),
  };
}

export async function logAuditAction(input: LogAuditInput): Promise<void> {
  if (!input.performedBy) {
    throw new Error("🛑 Missing PerformedBy in audit log input");
  }
  console.log("🧾 Audit:", safeSummary(input));
  await insertAuditLog({
    TableName: input.tableName ?? null,
    RecordID: input.recordId ?? null,
    Action: input.action,
    PerformedBy: input.performedBy,
    Route: input.route ?? null,
    Method: input.method ?? null,
    StatusCode: input.statusCode ?? null,
    Changes: input.changes ? JSON.stringify(input.changes) : null,
  });
}

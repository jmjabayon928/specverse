// src/backend/utils/logAuditAction.ts
import { insertAuditLog } from "@/backend/database/auditQueries";

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

export async function logAuditAction(input: LogAuditInput): Promise<void> {
  console.log("🧾 Final audit entry payload:", input);
  if (!input.performedBy) {
    throw new Error("🛑 Missing PerformedBy in audit log input");
  }
  console.log("📝 Logging audit action with PerformedBy:", input.performedBy);
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

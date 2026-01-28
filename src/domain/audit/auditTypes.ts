// src/domain/audit/auditTypes.ts

export interface AuditContext {
  userId: number
  route?: string
  method?: string
  ipAddress?: string
  userAgent?: string
}

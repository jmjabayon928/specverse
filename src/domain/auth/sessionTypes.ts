// src/domain/auth/sessionTypes.ts

export interface UserSession {
  // Core identity
  userId: number          // ID from Users table
  roleId: number          // RoleID from Roles table
  role: string            // e.g. 'Admin', 'Engineer'

  // Permissions
  permissions: string[]   // Permission keys from the role

  // Display profile
  name?: string           // Full name or display name
  email?: string          // Used in dropdowns and audit logs
  profilePic?: string     // Optional avatar URL or base64

  // Session meta
  lastLoginAt?: string    // ISO timestamp of last login
  isFirstLogin?: boolean  // For onboarding flows
  locale?: string         // e.g. 'en-CA', 'fr-CA'

  // Phase 2.5: active account for tenant-scoped data
  accountId?: number
}

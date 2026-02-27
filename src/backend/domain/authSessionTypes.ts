// src/backend/domain/authSessionTypes.ts

export interface AuthSessionRow {
  SidHash: Buffer // SHA-256 hash of sid (varbinary(32))
  UserID: number
  AccountID: number | null
  ExpiresAt: Date
  RevokedAt: Date | null
  CreatedAt: Date
}

export interface AuthSessionData {
  userId: number
  accountId: number | null
  roleId: number
  role: string
  email: string
  name: string
  profilePic: string | null
  permissions: string[]
  isSuperadmin?: boolean
}

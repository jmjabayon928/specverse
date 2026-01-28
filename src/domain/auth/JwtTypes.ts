// src/domain/auth/JwtTypes.ts
import { JwtPayload as DefaultJwtPayload } from 'jsonwebtoken'

export interface JwtPayload extends DefaultJwtPayload {
  userId: number
  roleId: number
  role: string
  email?: string
  name?: string
  profilePic?: string | null
  permissions?: string[]
}

// For places that still reference "access token payload" by name
export type JwtAccessTokenPayload = JwtPayload

// Pair returned by login/refresh endpoints
export interface JwtTokenPair {
  accessToken: string
  refreshToken: string
}

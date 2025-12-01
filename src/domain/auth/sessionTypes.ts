// src/types/session.ts

export interface UserSession {
  userId: number;               // Unique ID from Users table
  roleId: number;               // RoleID from Roles table
  role: string;                 // e.g. "Admin", "Engineer", etc.
  permissions: string[];        // All permission keys assigned via role

  // Optional profile info for display purposes
  name?: string;                // Full name or display name
  email?: string;               // Used in user dropdowns, audit logs
  profilePic?: string;          // Optional: base64 or URL

  lastLoginAt?: string;          // ISO date of last login (for audit/UX)
  isFirstLogin?: boolean;        // Flag for onboarding experience
  locale?: string;     
}

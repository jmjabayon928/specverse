// src/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id?: number;
      userId: number;
      roleId: number;
      role: string;
      email?: string;
      name?: string;
      profilePic?: string;
      permissions: string[];
      accountId?: number;
      isSuperadmin?: boolean;
    };
    skipAuth?: boolean; // ← Add this line
  }
}

// src/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      userId: number;
      roleId: number;
      role: string;
      email?: string;
      name?: string;
      profilePic?: string;
      permissions: string[];
    };
    skipAuth?: boolean; // ← Add this line
  }
}

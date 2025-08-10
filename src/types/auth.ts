// src/types/auth.ts
import type { Request } from "express";

export function getUserId(req: Request): number {
  const id = req.user?.userId;
  return typeof id === "number" && Number.isFinite(id) ? id : 0;
}

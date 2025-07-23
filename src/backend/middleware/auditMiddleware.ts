// src/backend/middleware/auditMiddleware.ts
import { Request, Response, NextFunction } from "express";
import { insertAuditLog } from "../database/auditQueries";

export function auditAction(action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", async () => {
      const userId = req.user?.userId;

      if (typeof userId !== "number") {
        console.warn("⚠️ Cannot log audit: userId is missing or invalid");
        return;
      }

      const status = res.statusCode;

      await insertAuditLog({
        Action: action,
        PerformedBy: userId,
        StatusCode: status,
        Route: req.originalUrl,
        Method: req.method,
        Changes: JSON.stringify(req.body ?? {}).slice(0, 1000),
      });
    });

    next();
  };
}

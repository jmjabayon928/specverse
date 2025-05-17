// src/backend/middleware/authMiddleware.ts

import { Request, Response, NextFunction } from "express";

export function mockUser(req: Request, res: Response, next: NextFunction) {
  req.user = {
    userId: 1,
    roles: ["admin", "warehouse"],
    permissions: [
      // ✅ Inventory
      "INVENTORY_VIEW",
      "INVENTORY_CREATE",
      "INVENTORY_EDIT",
      "INVENTORY_DELETE",
      "INVENTORY_TRANSACTION_CREATE",
      "INVENTORY_MAINTENANCE_VIEW",
      "INVENTORY_MAINTENANCE_CREATE",
      // ✅ Datasheets
      "DATASHEET_VIEW",
      "DATASHEET_EDIT",
      // ✅ Templates
      "TEMPLATE_VIEW",
      "TEMPLATE_EDIT"
    ],
  };
  next();
}

export function checkRolePermission(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user?.permissions.includes(requiredPermission)) {
      res.status(403).json({ message: "Forbidden" });
      return;      // ✅ return void
    }
    next();        // ✅ continue
  };
}

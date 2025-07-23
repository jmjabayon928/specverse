// src/backend/routes/permissionRoutes.ts
import express from "express";
import { poolPromise } from "../config/db";
import { requirePermission } from "../middleware/authMiddleware";

const router = express.Router();

// ✅ 1. Get all permissions
router.get("/permissions/all", requirePermission("PERMISSION_MANAGE"), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT PermissionID, PermissionKey FROM Permissions ORDER BY PermissionKey
    `);
    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Failed to fetch permissions:", err);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

// ✅ 2. Get all permissions per role
router.get("/permissions/by-role", requirePermission("PERMISSION_MANAGE"), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT r.RoleName, p.PermissionKey
      FROM RolePermissions rp
      JOIN Roles r ON rp.RoleID = r.RoleID
      JOIN Permissions p ON rp.PermissionID = p.PermissionID
    `);

    const map: Record<string, string[]> = {}; // ✅ Typed map

    result.recordset.forEach(({ RoleName, PermissionKey }) => {
      if (!map[RoleName]) map[RoleName] = [];
      map[RoleName].push(PermissionKey);
    });

    res.status(200).json(map);
  } catch (err) {
    console.error("❌ Failed to fetch role permissions:", err);
    res.status(500).json({ error: "Failed to fetch role permissions" });
  }
});

export default router;

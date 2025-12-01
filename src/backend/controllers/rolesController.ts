import type { RequestHandler } from "express";
import {
  listRoles as svcList,
  getRoleById as svcGet,
  createRole as svcCreate,
  updateRole as svcUpdate,
  deleteRole as svcDelete,
  listRolePermissions as svcListRolePerms,
  listAvailablePermissionsForRole as svcListAvail, 
  addPermissionToRole as svcAddPerm, 
  removePermissionFromRole as svcRemovePerm, 
  ListRolesResult,
} from "../services/rolesService";

/** GET /api/backend/settings/roles */
export const listRoles: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "20"), 10), 1), 100);
    const search = String(req.query.search ?? "").trim();

    const out: ListRolesResult = await svcList({ page, pageSize, search });
    res.json(out);
  } catch (err) {
    console.error("listRoles error:", err);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
};

/** GET /api/backend/settings/roles/:id */
export const getRole: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const row = await svcGet(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    res.json(row);
  } catch (err) {
    console.error("getRole error:", err);
    res.status(500).json({ error: "Failed to fetch role" });
  }
};

/** POST /api/backend/settings/roles */
export const createRole: RequestHandler = async (req, res) => {
  try {
    const { RoleName } = (req.body ?? {}) as { RoleName?: string | null };
    if (!RoleName || !RoleName.trim()) {
      return res.status(400).json({ error: "RoleName is required" });
    }

    const newId = await svcCreate({ RoleName: RoleName.trim() });
    res.status(201).json({ RoleID: newId });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "ROLENAME_CONFLICT") {
      return res.status(409).json({ error: "RoleName already exists" });
    }
    console.error("createRole error:", err);
    res.status(500).json({ error: "Failed to create role" });
  }
};

/** PATCH /api/backend/settings/roles/:id */
export const updateRole: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { RoleName } = (req.body ?? {}) as { RoleName?: string | null };
    const ok = await svcUpdate(id, { RoleName: RoleName ?? null });

    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "ROLENAME_CONFLICT") {
      return res.status(409).json({ error: "RoleName already exists" });
    }
    console.error("updateRole error:", err);
    res.status(500).json({ error: "Failed to update role" });
  }
};

/** DELETE /api/backend/settings/roles/:id */
export const deleteRole: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const ok = await svcDelete(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteRole error:", err);
    res.status(500).json({ error: "Failed to delete role" });
  }
};

export const getRolePermissions: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const role = await svcGet(id);
    if (!role) return res.status(404).json({ error: "Role not found" });

    const permissions = await svcListRolePerms(id);
    res.json({ role, permissions });
  } catch (err) {
    console.error("getRolePermissions error:", err);
    res.status(500).json({ error: "Failed to fetch role permissions" });
  }
};

// GET /roles/:id/permissions/available
export const getRoleAvailablePermissions: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });
    const perms = await svcListAvail(id);
    res.json(perms);
  } catch (err) {
    console.error("getRoleAvailablePermissions error:", err);
    res.status(500).json({ error: "Failed to fetch available permissions" });
  }
};

// POST /roles/:id/permissions { PermissionID }
export const addPermissionToRole: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { PermissionID } = (req.body ?? {}) as { PermissionID?: number };
    if (!Number.isFinite(id) || !Number.isFinite(PermissionID)) {
      return res.status(400).json({ error: "Invalid ids" });
    }
    const ok = await svcAddPerm(id, Number(PermissionID));
    if (!ok) return res.status(409).json({ error: "Permission already assigned or invalid" });
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("addPermissionToRole error:", err);
    res.status(500).json({ error: "Failed to add permission" });
  }
};

// DELETE /roles/:id/permissions/:permissionId
export const removePermissionFromRole: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const permissionId = Number(req.params.permissionId);
    if (!Number.isFinite(id) || !Number.isFinite(permissionId)) {
      return res.status(400).json({ error: "Invalid ids" });
    }
    const ok = await svcRemovePerm(id, permissionId);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("removePermissionFromRole error:", err);
    res.status(500).json({ error: "Failed to remove permission" });
  }
};
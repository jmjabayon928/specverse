import type { RequestHandler } from "express";
import {
  listPermissions as svcList,
  getPermissionById as svcGet,
  createPermission as svcCreate,
  updatePermission as svcUpdate,
  deletePermission as svcDelete,
  ListPermissionsResult,
} from "../services/permissionsService";

/** GET /api/backend/settings/permissions */
export const listPermissions: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "20"), 10), 1), 100);
    const search = String(req.query.search ?? "").trim();

    const out: ListPermissionsResult = await svcList({ page, pageSize, search });
    res.json(out);
  } catch (err) {
    console.error("listPermissions error:", err);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
};

/** GET /api/backend/settings/permissions/:id */
export const getPermission: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const row = await svcGet(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    res.json(row);
  } catch (err) {
    console.error("getPermission error:", err);
    res.status(500).json({ error: "Failed to fetch permission" });
  }
};

/** POST /api/backend/settings/permissions */
export const createPermission: RequestHandler = async (req, res) => {
  try {
    const { PermissionKey, Description } = (req.body ?? {}) as {
      PermissionKey?: string | null;
      Description?: string | null;
    };

    if (!PermissionKey || !PermissionKey.trim()) {
      return res.status(400).json({ error: "PermissionKey is required" });
    }

    const newId = await svcCreate({
      PermissionKey: PermissionKey.trim(),
      Description: (Description ?? "").trim() || null,
    });

    res.status(201).json({ PermissionID: newId });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "PERMISSIONKEY_CONFLICT") {
      return res.status(409).json({ error: "PermissionKey already exists" });
    }
    console.error("createPermission error:", err);
    res.status(500).json({ error: "Failed to create permission" });
  }
};

/** PATCH /api/backend/settings/permissions/:id */
export const updatePermission: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { PermissionKey, Description } = (req.body ?? {}) as {
      PermissionKey?: string | null;
      Description?: string | null;
    };

    const ok = await svcUpdate(id, {
      PermissionKey: PermissionKey ?? null,
      Description: Description ?? null,
    });

    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "PERMISSIONKEY_CONFLICT") {
      return res.status(409).json({ error: "PermissionKey already exists" });
    }
    console.error("updatePermission error:", err);
    res.status(500).json({ error: "Failed to update permission" });
  }
};

/** DELETE /api/backend/settings/permissions/:id */
export const deletePermission: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const ok = await svcDelete(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deletePermission error:", err);
    res.status(500).json({ error: "Failed to delete permission" });
  }
};

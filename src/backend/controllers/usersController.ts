import type { RequestHandler } from "express";
import {
  listUsers as svcList,
  getUserById as svcGet,
  createUser as svcCreate,
  updateUser as svcUpdate,
  deleteUser as svcDelete,
  ListUsersResult,
  CreateUserInput,
  UpdateUserInput,
} from "../services/usersService";

/** GET /api/backend/settings/users */
export const listUsers: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "20"), 10), 1), 100);
    const search = String(req.query.search ?? "").trim();

    const out: ListUsersResult = await svcList({ page, pageSize, search });
    res.json(out);
  } catch (err) {
    console.error("listUsers error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

/** GET /api/backend/settings/users/:id */
export const getUser: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const row = await svcGet(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    res.json(row);
  } catch (err) {
    console.error("getUser error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

/** POST /api/backend/settings/users */
export const createUser: RequestHandler = async (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<CreateUserInput>;
    if (!body.Email || !body.Password) {
      return res.status(400).json({ error: "Email and Password are required" });
    }

    const newId = await svcCreate({
      FirstName: body.FirstName ?? null,
      LastName: body.LastName ?? null,
      Email: body.Email,
      Password: body.Password,
      RoleID: body.RoleID ?? null,
      ProfilePic: body.ProfilePic ?? null,
      IsActive: body.IsActive ?? true,
    });

    res.status(201).json({ UserID: newId });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "EMAIL_CONFLICT") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("createUser error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
};

/** PATCH /api/backend/settings/users/:id */
export const updateUser: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const body = (req.body ?? {}) as Partial<UpdateUserInput>;
    const ok = await svcUpdate(id, {
      FirstName: body.FirstName ?? null,
      LastName: body.LastName ?? null,
      Email: body.Email ?? null,
      Password: body.Password,
      RoleID: body.RoleID ?? null,
      ProfilePic: body.ProfilePic ?? null,
      IsActive: typeof body.IsActive === "boolean" ? body.IsActive : true,
    });

    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "EMAIL_CONFLICT") {
      return res.status(409).json({ error: "Email already exists" });
    }
    console.error("updateUser error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
};

/** DELETE /api/backend/settings/users/:id */
export const deleteUser: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const ok = await svcDelete(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
};

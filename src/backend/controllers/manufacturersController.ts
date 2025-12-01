import type { RequestHandler } from "express";
import {
  listManufacturers as svcList,
  getManufacturerById as svcGet,
  createManufacturer as svcCreate,
  updateManufacturer as svcUpdate,
  deleteManufacturer as svcDelete,
  ListManufacturersResult,
} from "../services/manufacturersService";

/** GET /api/backend/settings/manufacturers */
export const listManufacturers: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "20"), 10), 1), 100);
    const search = String(req.query.search ?? "").trim();

    const out: ListManufacturersResult = await svcList({ page, pageSize, search });
    res.json(out);
  } catch (err) {
    console.error("listManufacturers error:", err);
    res.status(500).json({ error: "Failed to fetch manufacturers" });
  }
};

/** GET /api/backend/settings/manufacturers/:id */
export const getManufacturer: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const row = await svcGet(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    res.json(row);
  } catch (err) {
    console.error("getManufacturer error:", err);
    res.status(500).json({ error: "Failed to fetch manufacturer" });
  }
};

/** POST /api/backend/settings/manufacturers */
export const createManufacturer: RequestHandler = async (req, res) => {
  try {
    const { ManuName, ManuAddress } = (req.body ?? {}) as { ManuName?: string; ManuAddress?: string };

    if (!ManuName || !ManuName.trim() || !ManuAddress || !ManuAddress.trim()) {
      return res.status(400).json({ error: "ManuName and ManuAddress are required" });
    }
    if (ManuName.length > 150) return res.status(400).json({ error: "ManuName too long (max 150)" });
    if (ManuAddress.length > 255) return res.status(400).json({ error: "ManuAddress too long (max 255)" });

    const newId = await svcCreate({ ManuName: ManuName.trim(), ManuAddress: ManuAddress.trim() });
    res.status(201).json({ ManuID: newId });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "MANUNAME_CONFLICT") {
      return res.status(409).json({ error: "ManuName already exists" });
    }
    console.error("createManufacturer error:", err);
    res.status(500).json({ error: "Failed to create manufacturer" });
  }
};

/** PATCH /api/backend/settings/manufacturers/:id */
export const updateManufacturer: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const { ManuName, ManuAddress } = (req.body ?? {}) as { ManuName?: string | null; ManuAddress?: string | null };

    if (ManuName && ManuName.length > 150) return res.status(400).json({ error: "ManuName too long (max 150)" });
    if (ManuAddress && ManuAddress.length > 255) return res.status(400).json({ error: "ManuAddress too long (max 255)" });

    const ok = await svcUpdate(id, { ManuName: ManuName ?? undefined, ManuAddress: ManuAddress ?? undefined });

    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "MANUNAME_CONFLICT") {
      return res.status(409).json({ error: "ManuName already exists" });
    }
    console.error("updateManufacturer error:", err);
    res.status(500).json({ error: "Failed to update manufacturer" });
  }
};

/** DELETE /api/backend/settings/manufacturers/:id */
export const deleteManufacturer: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const ok = await svcDelete(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteManufacturer error:", err);
    res.status(500).json({ error: "Failed to delete manufacturer" });
  }
};

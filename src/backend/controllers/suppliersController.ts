import type { RequestHandler } from "express";
import {
  listSuppliers as svcList,
  getSupplierById as svcGet,
  createSupplier as svcCreate,
  updateSupplier as svcUpdate,
  deleteSupplier as svcDelete,
  ListSuppliersResult,
} from "../services/suppliersService";

/** GET /api/backend/settings/suppliers */
export const listSuppliers: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize ?? "20"), 10), 1), 100);
    const search = String(req.query.search ?? "").trim();

    const out: ListSuppliersResult = await svcList({ page, pageSize, search });
    res.json(out);
  } catch (err) {
    console.error("listSuppliers error:", err);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
};

/** GET /api/backend/settings/suppliers/:id */
export const getSupplier: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const row = await svcGet(id);
    if (!row) return res.status(404).json({ error: "Not found" });

    res.json(row);
  } catch (err) {
    console.error("getSupplier error:", err);
    res.status(500).json({ error: "Failed to fetch supplier" });
  }
};

/** POST /api/backend/settings/suppliers */
export const createSupplier: RequestHandler = async (req, res) => {
  try {
    const b = (req.body ?? {}) as {
      SuppName?: string;
      SuppAddress?: string | null;
      SuppCode?: string | null;
      SuppContact?: string | null;
      SuppEmail?: string | null;
      SuppPhone?: string | null;
      Notes?: string | null;
    };

    if (!b.SuppName || !b.SuppName.trim()) {
      return res.status(400).json({ error: "SuppName is required" });
    }
    if (b.SuppName.length > 255) return res.status(400).json({ error: "SuppName too long (max 255)" });
    if (b.SuppCode && b.SuppCode.length > 50) return res.status(400).json({ error: "SuppCode too long (max 50)" });
    if (b.SuppContact && b.SuppContact.length > 255) return res.status(400).json({ error: "SuppContact too long (max 255)" });
    if (b.SuppEmail && b.SuppEmail.length > 255) return res.status(400).json({ error: "SuppEmail too long (max 255)" });
    if (b.SuppPhone && b.SuppPhone.length > 50) return res.status(400).json({ error: "SuppPhone too long (max 50)" });

    const newId = await svcCreate({
      SuppName: b.SuppName.trim(),
      SuppAddress: b.SuppAddress ?? null,
      SuppCode: b.SuppCode?.trim() ?? null,
      SuppContact: b.SuppContact?.trim() ?? null,
      SuppEmail: b.SuppEmail?.trim() ?? null,
      SuppPhone: b.SuppPhone?.trim() ?? null,
      Notes: b.Notes ?? null,
    });

    res.status(201).json({ SuppID: newId });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "SUPPCODE_CONFLICT") {
      return res.status(409).json({ error: "SuppCode already exists" });
    }
    console.error("createSupplier error:", err);
    res.status(500).json({ error: "Failed to create supplier" });
  }
};

/** PATCH /api/backend/settings/suppliers/:id */
export const updateSupplier: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const b = (req.body ?? {}) as Partial<{
      SuppName: string;
      SuppAddress: string | null;
      SuppCode: string | null;
      SuppContact: string | null;
      SuppEmail: string | null;
      SuppPhone: string | null;
      Notes: string | null;
    }>;

    if (b.SuppName && b.SuppName.length > 255) return res.status(400).json({ error: "SuppName too long (max 255)" });
    if (b.SuppCode && b.SuppCode.length > 50) return res.status(400).json({ error: "SuppCode too long (max 50)" });
    if (b.SuppContact && b.SuppContact.length > 255) return res.status(400).json({ error: "SuppContact too long (max 255)" });
    if (b.SuppEmail && b.SuppEmail.length > 255) return res.status(400).json({ error: "SuppEmail too long (max 255)" });
    if (b.SuppPhone && b.SuppPhone.length > 50) return res.status(400).json({ error: "SuppPhone too long (max 50)" });

    const ok = await svcUpdate(id, {
      SuppName: b.SuppName,
      SuppAddress: b.SuppAddress,
      SuppCode: b.SuppCode,
      SuppContact: b.SuppContact,
      SuppEmail: b.SuppEmail,
      SuppPhone: b.SuppPhone,
      Notes: b.Notes,
    });

    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === "SUPPCODE_CONFLICT") {
      return res.status(409).json({ error: "SuppCode already exists" });
    }
    console.error("updateSupplier error:", err);
    res.status(500).json({ error: "Failed to update supplier" });
  }
};

/** DELETE /api/backend/settings/suppliers/:id */
export const deleteSupplier: RequestHandler = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid id" });

    const ok = await svcDelete(id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteSupplier error:", err);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
};

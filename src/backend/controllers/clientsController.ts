// src/backend/controllers/clientsController.ts
import type { RequestHandler } from "express";
import { poolPromise, sql } from "../config/db";

/* ----------------------------- Types ----------------------------- */

export type ClientRow = {
  ClientID: number;
  ClientCode: string;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ClientAddress: string;
  ContactPerson: string;
  ClientLogo: string;
  CreatedAt: string;
  UpdatedAt: string;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

type UpdatableClientFields = {
  ClientCode: string | null;
  ClientName: string | null;
  ClientEmail: string | null;
  ClientPhone: string | null;
  ClientAddress: string | null;
  ContactPerson: string | null;
  ClientLogo: string | null;
};

/* ----------------------- Small helper utilities ----------------------- */

// Avoid Object default stringification warnings and keep types safe
function qstr(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return fallback;
}
function qint(v: unknown, fallback: number): number {
  const s = qstr(v, String(fallback));
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}

// Normalize string inputs to nullable trimmed values
function toNullableTrimmed(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length ? s : null;
}

/* ----------------------------- List / Get ----------------------------- */

export const getClients: RequestHandler = async (req, res) => {
  const page = Math.max(qint(req.query.page, 1), 1);
  const pageSize = Math.min(Math.max(qint(req.query.pageSize, 20), 1), 100);
  const search = qstr(req.query.search, "").trim();

  const offset = (page - 1) * pageSize;

  try {
    const pool = await poolPromise;
    const request = pool.request();

    if (search) {
      request.input("q", sql.NVarChar(sql.MAX), `%${search}%`);
    }
    request.input("take", sql.Int, pageSize);
    request.input("skip", sql.Int, offset);

    const where = search
      ? `WHERE (ClientCode LIKE @q OR ClientName LIKE @q OR ClientEmail LIKE @q OR ClientPhone LIKE @q)`
      : "";

    const countResult = await request.query<{ total: number }>(`
      SELECT COUNT(*) AS total
      FROM Clients
      ${where};
    `);
    const total = countResult.recordset[0]?.total ?? 0;

    const rowsResult = await request.query<ClientRow>(`
      SELECT
        ClientID, ClientCode, ClientName, ClientEmail, ClientPhone,
        ClientAddress, ContactPerson, ClientLogo, CreatedAt, UpdatedAt
      FROM Clients
      ${where}
      ORDER BY ClientID DESC
      OFFSET @skip ROWS FETCH NEXT @take ROWS ONLY;
    `);

    const payload: Paged<ClientRow> = {
      page,
      pageSize,
      total,
      rows: rowsResult.recordset ?? [],
    };
    res.status(200).json(payload);
  } catch (e: unknown) {
    console.error("❌ getClients error:", e);
    const message = e instanceof Error ? e.message : "Failed to load clients";
    res.status(500).json({ error: message });
  }
};

export const getClientById: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid client id" });
    return;
  }

  try {
    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientID", sql.Int, id)
      .query<ClientRow>(`
        SELECT
          ClientID, ClientCode, ClientName, ClientEmail, ClientPhone,
          ClientAddress, ContactPerson, ClientLogo, CreatedAt, UpdatedAt
        FROM Clients
        WHERE ClientID = @ClientID;
      `);

    const row = r.recordset?.[0];
    if (!row) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.status(200).json(row);
  } catch (e: unknown) {
    console.error("❌ getClientById error:", e);
    const message = e instanceof Error ? e.message : "Failed to load client";
    res.status(500).json({ error: message });
  }
};

/* ----------------------------- Create ----------------------------- */

export const createClient: RequestHandler = async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Required (based on your form validations)
    const ClientCode = toNullableTrimmed(body.ClientCode);
    const ClientName = toNullableTrimmed(body.ClientName);
    const ClientEmail = toNullableTrimmed(body.ClientEmail);
    const ClientPhone = toNullableTrimmed(body.ClientPhone);
    const ClientAddress = toNullableTrimmed(body.ClientAddress);
    const ContactPerson = toNullableTrimmed(body.ContactPerson);
    const ClientLogo = toNullableTrimmed(body.ClientLogo);

    const missing = [
      ["ClientCode", ClientCode],
      ["ClientName", ClientName],
      ["ClientEmail", ClientEmail],
      ["ClientPhone", ClientPhone],
      ["ClientAddress", ClientAddress],
      ["ContactPerson", ContactPerson],
      ["ClientLogo", ClientLogo],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k as string);

    if (missing.length) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` });
      return;
    }

    const pool = await poolPromise;
    const r = await pool
      .request()
      .input("ClientCode", sql.NVarChar(sql.MAX), ClientCode)
      .input("ClientName", sql.NVarChar(sql.MAX), ClientName)
      .input("ClientEmail", sql.NVarChar(sql.MAX), ClientEmail)
      .input("ClientPhone", sql.NVarChar(sql.MAX), ClientPhone)
      .input("ClientAddress", sql.NVarChar(sql.MAX), ClientAddress)
      .input("ContactPerson", sql.NVarChar(sql.MAX), ContactPerson)
      .input("ClientLogo", sql.NVarChar(sql.MAX), ClientLogo)
      .query<ClientRow>(`
        INSERT INTO Clients
          (ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson, ClientLogo, CreatedAt, UpdatedAt)
        OUTPUT inserted.ClientID, inserted.ClientCode, inserted.ClientName, inserted.ClientEmail, inserted.ClientPhone,
               inserted.ClientAddress, inserted.ContactPerson, inserted.ClientLogo, inserted.CreatedAt, inserted.UpdatedAt
        VALUES
          (@ClientCode, @ClientName, @ClientEmail, @ClientPhone, @ClientAddress, @ContactPerson, @ClientLogo, SYSUTCDATETIME(), SYSUTCDATETIME());
      `);

    res.status(201).json(r.recordset[0]);
  } catch (e: unknown) {
    console.error("❌ createClient error:", e);
    const message = e instanceof Error ? e.message : "Failed to create client";
    res.status(500).json({ error: message });
  }
};

/* ----------------------------- Update ----------------------------- */

const ALLOWED: (keyof UpdatableClientFields)[] = [
  "ClientCode",
  "ClientName",
  "ClientEmail",
  "ClientPhone",
  "ClientAddress",
  "ContactPerson",
  "ClientLogo",
];

function buildUpdatePayload(body: Record<string, unknown>): Partial<UpdatableClientFields> {
  const out: Partial<UpdatableClientFields> = {};
  for (const k of ALLOWED) {
    if (!Object.hasOwn(body, k)) continue;  // ✅ ES2022
    const v = body[k];
    out[k] = toNullableTrimmed(v);
  }
  return out;
}

function buildUpdateSql(payload: Partial<UpdatableClientFields>) {
  const keys = Object.keys(payload) as (keyof UpdatableClientFields)[];
  const setClauses = keys.map((k) => `${k} = @${k}`);
  return { keys, setSql: setClauses.join(", ") };
}

export const updateClient: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid client id" });
    return;
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const payload = buildUpdatePayload(body);

    if (Object.keys(payload).length === 0) {
      res.status(400).json({ error: "No updatable fields provided" });
      return;
    }

    const { keys, setSql } = buildUpdateSql(payload);

    const pool = await poolPromise;
    const request = pool.request();

    for (const k of keys) {
      request.input(k as string, sql.NVarChar(sql.MAX), payload[k] ?? null);
    }
    request.input("ClientID", sql.Int, id);

    const result = await request.query<ClientRow>(`
      UPDATE Clients
      SET ${setSql}, UpdatedAt = SYSUTCDATETIME()
      WHERE ClientID = @ClientID;

      SELECT TOP (1)
        ClientID, ClientCode, ClientName, ClientEmail, ClientPhone,
        ClientAddress, ContactPerson, ClientLogo, CreatedAt, UpdatedAt
      FROM Clients
      WHERE ClientID = @ClientID;
    `);

    const row = result.recordset?.[0];
    if (!row) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.status(200).json(row);
  } catch (e: unknown) {
    console.error("❌ updateClient error:", e);
    const message = e instanceof Error ? e.message : "Failed to update client";
    res.status(500).json({ error: message });
  }
};

/* ----------------------------- Delete ----------------------------- */

export const deleteClient: RequestHandler = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    res.status(400).json({ error: "Invalid client id" });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("ClientID", sql.Int, id)
      .query(`
        DELETE FROM Clients WHERE ClientID = @ClientID;
        SELECT @@ROWCOUNT AS affected;
      `);

    const affected = (result.recordset?.[0]?.affected as number) ?? 0;
    if (affected === 0) {
      res.status(404).json({ error: "Client not found" });
      return;
    }
    res.status(200).json({ success: true });
  } catch (e: unknown) {
    console.error("❌ deleteClient error:", e);
    const message = e instanceof Error ? e.message : "Failed to delete client";
    res.status(500).json({ error: message });
  }
};

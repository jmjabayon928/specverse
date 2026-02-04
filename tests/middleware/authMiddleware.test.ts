// tests/middleware/authMiddleware.test.ts
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { verifyToken } from "../../src/backend/middleware/authMiddleware";
import cookieParser from "cookie-parser";

jest.mock("../../src/backend/database/accountContextQueries", () => {
  return {
    getAccountContextForUser: jest.fn().mockResolvedValue({
      accountId: 1,
      roleId: 1,
      roleName: "Admin",
      permissions: [],
    }),
    getDefaultAccountId: jest.fn().mockResolvedValue(1),
    getActiveAccountId: jest.fn().mockResolvedValue(5),
  };
});

const { getAccountContextForUser, getActiveAccountId } = jest.requireMock<
  typeof import("../../src/backend/database/accountContextQueries")
>("../../src/backend/database/accountContextQueries");

describe("verifyToken middleware", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "secret";
    process.env.SUPERADMIN_USER_IDS = "";
    process.env.SUPERADMIN_EMAILS = "";
    (getAccountContextForUser as jest.Mock).mockResolvedValue({
      accountId: 1,
      roleId: 1,
      roleName: "Admin",
      permissions: [],
    });
    (getActiveAccountId as jest.Mock).mockResolvedValue(5);
  });

  function makeToken(payload: Record<string, unknown>) {
    return jwt.sign(payload, process.env.JWT_SECRET || "secret", { expiresIn: "1h" });
  }

  it("should block access without token", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.get("/protected", verifyToken, (_req, res) => {
      res.json({ message: "Access granted" });
    });

    const res = await request(app).get("/protected");
    expect(res.statusCode).toBe(401);
  });

  it("should allow access with valid token and derive accountId from membership", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.get("/protected", verifyToken, (req, res) => {
      res.json({ message: "Access granted", accountId: req.user?.accountId ?? null });
    });

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      profilePic: null,
      permissions: [],
    });

    const res = await request(app).get("/protected").set("Cookie", [`token=${token}`]);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Access granted");
    expect(res.body.accountId).toBe(1);
  });

  it("allows superadmin override on /api/backend/platform/* routes", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    process.env.SUPERADMIN_USER_IDS = "1";

    app.get("/api/backend/platform/accounts", verifyToken, (req, res) => {
      res.json({ accountId: req.user?.accountId ?? null });
    });

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      profilePic: null,
      permissions: [],
    });

    const res = await request(app)
      .get("/api/backend/platform/accounts")
      .set("Cookie", [`token=${token}`])
      .set("x-specverse-account-id", "5");

    expect(res.statusCode).toBe(200);
    expect(res.body.accountId).toBe(5);
    expect(getActiveAccountId).toHaveBeenCalledWith(5);
  });

  it("does NOT allow superadmin override on normal product routes", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    process.env.SUPERADMIN_USER_IDS = "1";

    app.get("/api/backend/settings/clients", verifyToken, (req, res) => {
      res.json({ accountId: req.user?.accountId ?? null });
    });

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      profilePic: null,
      permissions: [],
    });

    const res = await request(app)
      .get("/api/backend/settings/clients")
      .set("Cookie", [`token=${token}`])
      .set("x-specverse-account-id", "5");

    expect(res.statusCode).toBe(403);
  });

  it("rejects non-superadmin using override header on platform route", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    process.env.SUPERADMIN_USER_IDS = ""; // userId=1 is not superadmin

    app.get("/api/backend/platform/accounts", verifyToken, (_req, res) => {
      res.json({ ok: true });
    });

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      profilePic: null,
      permissions: [],
    });

    const res = await request(app)
      .get("/api/backend/platform/accounts")
      .set("Cookie", [`token=${token}`])
      .set("x-specverse-account-id", "5");

    expect(res.statusCode).toBe(403);
  });

  it("returns 400 for invalid (non-numeric) override header on platform route", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    process.env.SUPERADMIN_USER_IDS = "1";

    app.get("/api/backend/platform/accounts", verifyToken, (_req, res) => {
      res.json({ ok: true });
    });

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      profilePic: null,
      permissions: [],
    });

    const res = await request(app)
      .get("/api/backend/platform/accounts")
      .set("Cookie", [`token=${token}`])
      .set("x-specverse-account-id", "not-a-number");

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when override header points to inactive/missing account", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    process.env.SUPERADMIN_USER_IDS = "1";
    (getActiveAccountId as jest.Mock).mockResolvedValueOnce(null);

    app.get("/api/backend/platform/accounts", verifyToken, (_req, res) => {
      res.json({ ok: true });
    });

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      profilePic: null,
      permissions: [],
    });

    const res = await request(app)
      .get("/api/backend/platform/accounts")
      .set("Cookie", [`token=${token}`])
      .set("x-specverse-account-id", "999");

    expect(res.statusCode).toBe(404);
  });

  it("honors override on platform route when URL has query string", async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());

    process.env.SUPERADMIN_USER_IDS = "1";

    app.get("/api/backend/platform/accounts", verifyToken, (req, res) => {
      res.json({ accountId: req.user?.accountId ?? null });
    });

    const token = makeToken({
      userId: 1,
      roleId: 1,
      role: "admin",
      email: "admin@example.com",
      name: "Admin",
      profilePic: null,
      permissions: [],
    });

    const res = await request(app)
      .get("/api/backend/platform/accounts?foo=bar")
      .set("Cookie", [`token=${token}`])
      .set("x-specverse-account-id", "5");

    expect(res.statusCode).toBe(200);
    expect(res.body.accountId).toBe(5);
  });
});

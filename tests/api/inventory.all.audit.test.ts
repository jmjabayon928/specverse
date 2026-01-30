// tests/api/inventory.all.audit.test.ts
// GET /api/backend/inventory/all/audit: 401 without auth, 200 with auth; body is array with unique integer auditLogId per row.
import request from "supertest";
import jwt from "jsonwebtoken";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../../src/backend/middleware/errorHandler";

process.env.JWT_SECRET ??= "secret";

jest.mock("../../src/backend/database/inventoryTransactionQueries", () => {
  const actual = jest.requireActual("../../src/backend/database/inventoryTransactionQueries");
  return {
    ...actual,
    getAllInventoryAuditLogs: jest.fn(),
  };
});

const inventoryTransactionQueries = require("../../src/backend/database/inventoryTransactionQueries");
const mockGetAllInventoryAuditLogs =
  inventoryTransactionQueries.getAllInventoryAuditLogs as jest.Mock;

jest.mock("../../src/backend/database/permissionQueries", () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}));

function createAuthCookie(): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: "test@example.com",
      fullName: "Test User",
      role: "Admin",
      profilePic: null,
      permissions: ["INVENTORY_VIEW"],
    },
    process.env.JWT_SECRET ?? "secret",
    { expiresIn: "1h" }
  );
  return `token=${token}`;
}

function buildTestApp(): express.Express {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const inventoryRoutes = require("../../src/backend/routes/inventoryRoutes").default;
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/backend/inventory", inventoryRoutes);
  app.use(errorHandler);
  return app;
}

describe("GET /api/backend/inventory/all/audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllInventoryAuditLogs.mockResolvedValue([
      {
        auditLogId: 1,
        inventoryId: 10,
        itemName: "Item A",
        actionType: "Update",
        oldValue: "x",
        newValue: "y",
        changedBy: "Jane Doe",
        changedAt: "2026-01-30T12:00:00",
      },
      {
        auditLogId: 2,
        inventoryId: 11,
        itemName: "Item B",
        actionType: "Create",
        oldValue: "",
        newValue: "z",
        changedBy: "John Doe",
        changedAt: "2026-01-30T11:00:00",
      },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/api/backend/inventory/all/audit");
    expect(res.statusCode).toBe(401);
    expect(mockGetAllInventoryAuditLogs).not.toHaveBeenCalled();
  });

  it("returns 200 and array with unique integer auditLogId per row when authenticated", async () => {
    const app = buildTestApp();
    const authCookie = createAuthCookie();
    const res = await request(app)
      .get("/api/backend/inventory/all/audit")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const rows = res.body as Array<{ auditLogId: unknown }>;
    for (const r of rows) {
      expect(r).toHaveProperty("auditLogId");
      expect(Number.isInteger(r.auditLogId)).toBe(true);
    }
    expect(new Set(rows.map((r) => r.auditLogId)).size).toBe(rows.length);
  });
});

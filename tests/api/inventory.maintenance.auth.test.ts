// tests/api/inventory.maintenance.auth.test.ts
// Integration test: GET /api/backend/inventory/:id/maintenance returns 401 without auth, 200 with auth (cookie).
import request from "supertest";
import jwt from "jsonwebtoken";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../../src/backend/middleware/errorHandler";

process.env.JWT_SECRET ??= "secret";

const mockGetInventoryMaintenanceLogs = jest.fn();

jest.mock("../../src/backend/database/inventoryMaintenanceQueries", () => ({
  getInventoryMaintenanceLogs: (...args: unknown[]) =>
    mockGetInventoryMaintenanceLogs(...args),
}));

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
      permissions: ["INVENTORY_MAINTENANCE_VIEW"],
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

describe("Inventory maintenance auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInventoryMaintenanceLogs.mockResolvedValue([]);
  });

  it("GET /api/backend/inventory/:id/maintenance returns 401 when unauthenticated", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/api/backend/inventory/1/maintenance");
    expect(res.statusCode).toBe(401);
    expect(mockGetInventoryMaintenanceLogs).not.toHaveBeenCalled();
  });

  it("GET /api/backend/inventory/:id/maintenance returns 200 when authenticated with cookie", async () => {
    const app = buildTestApp();
    const authCookie = createAuthCookie();
    const res = await request(app)
      .get("/api/backend/inventory/1/maintenance")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(mockGetInventoryMaintenanceLogs).toHaveBeenCalledWith(1);
    expect(Array.isArray(res.body)).toBe(true);
  });

  const canonicalMaintenanceKeys = [
    "maintenanceId",
    "inventoryId",
    "maintenanceDate",
    "description",
    "notes",
    "performedByUserId",
    "performedByName",
    "createdAt",
  ].sort();

  it("GET /api/backend/inventory/1/maintenance returns array with canonical shape when authenticated", async () => {
    mockGetInventoryMaintenanceLogs.mockResolvedValueOnce([
      {
        maintenanceId: 1,
        inventoryId: 10,
        maintenanceDate: "2026-01-30T12:00:00",
        description: "Routine check",
        notes: null,
        performedByUserId: 2,
        performedByName: "Jane Doe",
        createdAt: "2026-01-30T12:00:00",
      },
    ]);
    const app = buildTestApp();
    const authCookie = createAuthCookie();
    const res = await request(app)
      .get("/api/backend/inventory/1/maintenance")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length >= 1) {
      const first = res.body[0] as Record<string, unknown>;
      expect(Object.keys(first).sort()).toEqual(canonicalMaintenanceKeys);
      expect(Number.isInteger(first.maintenanceId)).toBe(true);
      expect(Number.isInteger(first.inventoryId)).toBe(true);
      expect(Number.isNaN(Date.parse(String(first.maintenanceDate)))).toBe(false);
      expect(Number.isNaN(Date.parse(String(first.createdAt)))).toBe(false);
    }
  });
});

// tests/api/inventory.audit.auth.test.ts
// Integration test: GET /api/backend/inventory/:id/audit returns 401 without auth, 200 with auth (cookie).
import request from "supertest";
import jwt from "jsonwebtoken";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../../src/backend/middleware/errorHandler";

process.env.JWT_SECRET ??= "secret";

const mockGetInventoryAuditLogs = jest.fn();

jest.mock("../../src/backend/database/inventoryAuditQueries", () => ({
  getInventoryAuditLogs: (...args: unknown[]) => mockGetInventoryAuditLogs(...args),
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

describe("Inventory audit auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetInventoryAuditLogs.mockResolvedValue([]);
  });

  it("GET /api/backend/inventory/:id/audit returns 401 when unauthenticated", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/api/backend/inventory/1/audit");
    expect(res.statusCode).toBe(401);
    expect(mockGetInventoryAuditLogs).not.toHaveBeenCalled();
  });

  it("GET /api/backend/inventory/:id/audit returns 200 when authenticated with cookie", async () => {
    const app = buildTestApp();
    const authCookie = createAuthCookie();
    const res = await request(app)
      .get("/api/backend/inventory/1/audit")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(mockGetInventoryAuditLogs).toHaveBeenCalledWith(1);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

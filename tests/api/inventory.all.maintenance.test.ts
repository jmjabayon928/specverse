// tests/api/inventory.all.maintenance.test.ts
// GET /api/backend/inventory/all/maintenance: 401 without auth, 200 with auth; body is array with maintenanceId, inventoryId, itemName.
import request from "supertest";
import jwt from "jsonwebtoken";
import express from "express";
import cookieParser from "cookie-parser";
import { errorHandler } from "../../src/backend/middleware/errorHandler";
import { AppError } from "../../src/backend/errors/AppError";

process.env.JWT_SECRET ??= "secret";

jest.mock("../../src/backend/database/inventoryTransactionQueries", () => {
  const actual = jest.requireActual("../../src/backend/database/inventoryTransactionQueries");
  return {
    ...actual,
    getAllInventoryMaintenanceLogs: jest.fn(),
  };
});

const inventoryTransactionQueries = require("../../src/backend/database/inventoryTransactionQueries");
const mockGetAllInventoryMaintenanceLogs =
  inventoryTransactionQueries.getAllInventoryMaintenanceLogs as jest.Mock;

jest.mock("../../src/backend/database/permissionQueries", () => ({
  checkUserPermission: jest.fn().mockResolvedValue(true),
}));

const mockAuthUser = {
  userId: 1,
  roleId: 1,
  role: "Admin",
  permissions: ["INVENTORY_MAINTENANCE_VIEW"] as string[],
};

jest.mock("../../src/backend/middleware/authMiddleware", () => ({
  verifyToken: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const token = req.cookies?.token ?? req.headers.authorization?.split(" ")[1];
    if (!token) {
      next(new AppError("Unauthorized - No token", 401));
      return;
    }
    req.user = { ...mockAuthUser };
    next();
  },
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
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

describe("GET /api/backend/inventory/all/maintenance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllInventoryMaintenanceLogs.mockResolvedValue([
      {
        maintenanceId: 1,
        inventoryId: 10,
        itemName: "Test Item",
        maintenanceDate: "2026-01-30",
        description: "Routine check",
        performedByUserId: 2,
        performedByName: "Jane Doe",
        notes: null,
        createdAt: "2026-01-30T12:00:00",
      },
    ]);
  });

  it("returns 401 when unauthenticated", async () => {
    const app = buildTestApp();
    const res = await request(app).get("/api/backend/inventory/all/maintenance");
    expect(res.statusCode).toBe(401);
    expect(mockGetAllInventoryMaintenanceLogs).not.toHaveBeenCalled();
  });

  it("returns 200 and array with maintenanceId, inventoryId, itemName when authenticated", async () => {
    const app = buildTestApp();
    const authCookie = createAuthCookie();
    const res = await request(app)
      .get("/api/backend/inventory/all/maintenance")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(mockGetAllInventoryMaintenanceLogs).toHaveBeenCalled();
    if (res.body.length > 0) {
      const first = res.body[0] as {
        maintenanceId?: number;
        inventoryId?: number;
        itemName?: string;
      };
      expect(first).toHaveProperty("maintenanceId");
      expect(first).toHaveProperty("inventoryId");
      expect(first).toHaveProperty("itemName");
      expect(typeof first.maintenanceId).toBe("number");
      expect(typeof first.inventoryId).toBe("number");
      expect(typeof first.itemName).toBe("string");
    }
  });
});

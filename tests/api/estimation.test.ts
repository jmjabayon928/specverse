import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../../src/backend/app";
import { poolPromise } from "../../src/backend/config/db";
import type { SupplierQuoteUpdateResponse } from "../../src/domain/estimations/estimationTypes";

process.env.JWT_SECRET ??= "secret";

function createAuthCookie(): string {
  const token = jwt.sign(
    {
      userId: 1,
      email: "test@example.com",
      fullName: "Test User",
      role: "Admin",
      profilePic: null,
      permissions: [],
    },
    process.env.JWT_SECRET ?? "secret",
    { expiresIn: "1h" }
  );
  return `token=${token}`;
}

describe("Estimation API", () => {
  const authCookie = createAuthCookie();

  it("should GET all estimations", async () => {
    const res = await request(app)
      .get("/api/backend/estimation")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("GET /api/backend/estimation/history never routes to :id handler (regression)", async () => {
    const res = await request(app)
      .get("/api/backend/estimation/history")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const body = res.body as unknown;
    expect(body).not.toMatchObject({ message: "Invalid EstimationID" });
    if (typeof body === "object" && body !== null && "message" in body) {
      expect((body as { message: string }).message).not.toBe("Invalid EstimationID");
    }
  });

  it("GET /api/backend/estimation/0 hits :id handler and returns 400 or 404", async () => {
    const res = await request(app)
      .get("/api/backend/estimation/0")
      .set("Cookie", [authCookie]);
    expect([400, 404]).toContain(res.statusCode);
  });

  it("GET /api/backend/estimation/history returns 200 and an array with correct shape", async () => {
    const res = await request(app)
      .get("/api/backend/estimation/history")
      .set("Cookie", [authCookie]);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const list = res.body as Array<{
      EstimationID: number;
      Title: string;
      ItemCount: number;
      TotalCost: number;
      CreatedAt: string;
      LastModified: string | null;
    }>;
    if (list.length > 0) {
      const first = list[0];
      expect(typeof first.EstimationID).toBe("number");
      expect(Number.isInteger(first.EstimationID)).toBe(true);
      expect(typeof first.Title).toBe("string");
      expect(first).toHaveProperty("ItemCount");
      expect(first).toHaveProperty("TotalCost");
      expect(first).toHaveProperty("CreatedAt");
      expect(first).toHaveProperty("LastModified");
      expect(typeof first.ItemCount).toBe("number");
      expect(typeof first.TotalCost).toBe("number");
      expect(first.LastModified === null || typeof first.LastModified === "string").toBe(true);
    }
  });

  it("should POST a new estimation", async () => {
    const newEstimation = {
      ProjectID: 1,
      ClientID: 1,
      Title: "Test Project",
      Description: "Test description",
      CreatedBy: 1
    };

    const res = await request(app)
      .post("/api/backend/estimation")
      .set("Cookie", [authCookie])
      .send(newEstimation);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("EstimationID");
  });

  it("should return 400 or 500 if required fields are missing", async () => {
    const res = await request(app)
      .post("/api/backend/estimation")
      .set("Cookie", [authCookie])
      .send({ Title: "Invalid Estimation" }); // Missing required fields

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("GET /api/backend/estimation/quotes/all returns 200 and every quote row has unique QuoteRowID", async () => {
    const res = await request(app)
      .get("/api/backend/estimation/quotes/all")
      .set("Cookie", [authCookie]);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const quotes = res.body as Array<{ QuoteRowID: number; QuoteID: number }>;
    for (const quote of quotes) {
      expect(quote).toHaveProperty("QuoteRowID");
      expect(typeof quote.QuoteRowID).toBe("number");
      expect(Number.isInteger(quote.QuoteRowID)).toBe(true);
    }
    const ids = quotes.map((q) => q.QuoteRowID);
    expect(new Set(ids).size).toBe(quotes.length);
  });

  it("PUT /api/backend/estimation/quotes/:id returns minimal SupplierQuoteUpdateResponse shape", async () => {
    const listRes = await request(app)
      .get("/api/backend/estimation/quotes/all")
      .set("Cookie", [authCookie]);
    expect(listRes.statusCode).toBe(200);
    const quotes = listRes.body as Array<{ QuoteRowID: number; QuoteID: number }>;
    expect(quotes.length).toBeGreaterThan(0);
    const quoteId = quotes[0].QuoteID;
    const putRes = await request(app)
      .put(`/api/backend/estimation/quotes/${quoteId}`)
      .set("Cookie", [authCookie])
      .send({
        QuotedUnitCost: 1,
        ExpectedDeliveryDays: 0,
        CurrencyCode: "USD",
        IsSelected: false,
        Notes: "",
      });
    expect(putRes.statusCode).toBe(200);
    const body = putRes.body as SupplierQuoteUpdateResponse;
    expect(body).toHaveProperty("QuoteRowID");
    expect(body).toHaveProperty("QuoteID");
    expect(body).toHaveProperty("ItemID");
    expect(body).toHaveProperty("SupplierID");
    expect(body).toHaveProperty("QuotedUnitCost");
    expect(body).toHaveProperty("ExpectedDeliveryDays");
    expect(body).toHaveProperty("CurrencyCode");
    expect(body).toHaveProperty("IsSelected");
    expect(body).toHaveProperty("Notes");
    expect(Object.keys(body).sort()).toEqual([
      "CurrencyCode", "ExpectedDeliveryDays", "IsSelected", "ItemID", "Notes",
      "QuoteID", "QuoteRowID", "QuotedUnitCost", "SupplierID"
    ]);
    expect(typeof body.QuoteRowID).toBe("number");
    expect(Number.isInteger(body.QuoteRowID)).toBe(true);
    expect(body.QuoteRowID).toBe(body.QuoteID);
  });

  afterAll(async () => {
    const pool = await poolPromise;
    await pool.request().query(`
      DELETE FROM Estimations WHERE Title = 'Test Project'
    `);
  });
});

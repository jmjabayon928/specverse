import request from "supertest";
import app from "../../src/backend/app";
import { poolPromise } from "../../src/backend/config/db";

describe("Estimation API", () => {
  it("should GET all estimations", async () => {
    const res = await request(app).get("/api/backend/estimation");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
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
      .send(newEstimation);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("EstimationID");
  });

  it("should return 400 or 500 if required fields are missing", async () => {
    const res = await request(app)
      .post("/api/backend/estimation")
      .send({ Title: "Invalid Estimation" }); // Missing required fields

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });

  afterAll(async () => {
    const pool = await poolPromise;
    await pool.request().query(`
      DELETE FROM Estimations WHERE Title = 'Test Project'
    `);
  });
});

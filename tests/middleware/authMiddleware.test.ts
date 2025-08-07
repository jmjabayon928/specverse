// tests/middleware/authMiddleware.test.ts
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { verifyToken } from "../../src/backend/middleware/authMiddleware";
import cookieParser from "cookie-parser";

const app = express();
app.use(express.json());
app.use(cookieParser()); // Required to read cookies

// Protected route for testing
app.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "Access granted" });
});

describe("verifyToken middleware", () => {
  it("should block access without token", async () => {
    const res = await request(app).get("/protected");
    expect(res.statusCode).toBe(401);
  });

  it("should allow access with valid token", async () => {
    const token = jwt.sign(
      {
        userId: 1,
        roleId: 1,
        role: "admin",
        email: "admin@example.com",
        name: "Admin",
        profilePic: null,
        permissions: [],
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/protected")
      .set("Cookie", [`token=${token}`]);

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe("Access granted");
  });
});

// src/backend/routes/categoriesRoutes.ts
import { Router } from "express";
import { poolPromise } from "../config/db"; // ✅ Use shared connection

const router = Router();

// Get all categories
router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise; // ✅ This is already a connected pool

    const result = await pool.request().query(
      "SELECT CategoryID, CategoryCode, CategoryName, CategoryNameFr FROM Categories"
    );

    console.log("✅ Query Successful:", result.recordset);

    res.json(result.recordset);
  } catch (error) {
    console.error("⛔ Database Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
});

export default router;

import { Router } from "express";
import sql from "mssql";

const router = Router();

// Get all categories
router.get("/", async (req, res) => {
  try {
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_DATABASE,
      options: {
        encrypt: false,
        enableArithAbort: true,
      },
    });

    console.log("✅ Database Connected");

    const result = await pool.request().query(
      "SELECT CategoryID, CategoryCode, CategoryName, CategoryNameFr FROM Categories"
    );

    console.log("✅ Query Successful: ", result.recordset);

    res.json(result.recordset);
  } catch (error) {
    console.error("⛔ Database Error:", error);
    res.status(500).json({ error: "Internal Server Error", details: error });
  }
});

export default router;

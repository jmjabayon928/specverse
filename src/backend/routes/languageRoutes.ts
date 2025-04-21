// src/backend/routes/languageRoutes.ts
import { Router } from "express";
import { poolPromise } from "../config/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT LanguageCode, LanguageName, FlagEmoji FROM Languages");
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching languages:", err);
    res.status(500).json({ error: "Failed to load languages" });
  }
});

export default router;

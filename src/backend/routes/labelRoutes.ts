import { Router } from "express";
import { poolPromise, sql } from "../config/db";

const router = Router();

// 🔁 Get all static UI label translations
router.get("/ui-labels", async (req, res) => {
  const lang = req.query.lang as string;

  if (!lang) {
    return res.status(400).json({ error: "Language code is required" });
  }

  try {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("LanguageCode", sql.VarChar(10), lang)
      .query(`
        SELECT LabelKey, TranslatedText 
        FROM UILabelTranslations 
        WHERE LanguageCode = @LanguageCode
      `);

    const labelMap: Record<string, string> = {};
    result.recordset.forEach((row) => {
      labelMap[row.LabelKey] = row.TranslatedText;
    });

    res.json(labelMap);
  } catch (error) {
    console.error("❌ Failed to fetch UI label translations:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

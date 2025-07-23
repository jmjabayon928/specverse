// src/backend/routes/referenceRoutes.ts
import express from "express";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";

const router = express.Router();

router.get("/references", async (req, res) => {
  try {
    const result = await fetchReferenceOptions();
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Failed to fetch reference data:", err);
    res.status(500).json({ error: "Failed to fetch reference data" });
  }
});

export default router;

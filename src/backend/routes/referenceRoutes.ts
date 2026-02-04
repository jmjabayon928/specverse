// src/backend/routes/referenceRoutes.ts
import express from "express";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import { verifyToken } from "@/backend/middleware/authMiddleware";

const router = express.Router();

router.get("/references", verifyToken, async (req, res) => {
  try {
    const accountId = req.user?.accountId;
    if (!accountId) {
      res.status(403).json({ error: "Missing account context" });
      return;
    }

    const result = await fetchReferenceOptions(accountId);
    res.status(200).json(result);
  } catch (err) {
    console.error("❌ Failed to fetch reference data:", err);
    res.status(500).json({ error: "Failed to fetch reference data" });
  }
});

export default router;

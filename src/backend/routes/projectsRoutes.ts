import express from "express";
import { getAllProjects } from "../database/projectQueries";

const router = express.Router();

// GET /api/projects
router.get("/", async (req, res) => {
  try {
    const data = await getAllProjects(); // ← this should return ProjectID and ProjName
    res.json(data);
  } catch (err) {
    console.error("Failed to fetch projects:", err);
    res.status(500).json({ error: "Failed to load projects" });
  }
});

export default router;

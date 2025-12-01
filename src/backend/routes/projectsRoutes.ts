import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectOptions,
} from "../controllers/projectsController";

const router = Router();

router.get("/", verifyToken, listProjects);
router.get("/options", verifyToken, getProjectOptions); // clients + managers for form
router.get("/:id", verifyToken, getProject);
router.post("/", verifyToken, createProject);
router.patch("/:id", verifyToken, updateProject);
router.delete("/:id", verifyToken, deleteProject);

export default router;

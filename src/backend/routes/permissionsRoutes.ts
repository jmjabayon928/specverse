import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  listPermissions,
  getPermission,
  createPermission,
  updatePermission,
  deletePermission,
} from "../controllers/permissionsController";

const router = Router();

router.get("/", verifyToken, listPermissions);
router.get("/:id", verifyToken, getPermission);
router.post("/", verifyToken, createPermission);
router.patch("/:id", verifyToken, updatePermission);
router.delete("/:id", verifyToken, deletePermission);

export default router;

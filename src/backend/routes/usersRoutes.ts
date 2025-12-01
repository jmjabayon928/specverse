import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import { listUsers, getUser, createUser, updateUser, deleteUser } from "../controllers/usersController";

const router = Router();

router.get("/", verifyToken, listUsers);
router.get("/:id", verifyToken, getUser);
router.post("/", verifyToken, createUser);
router.patch("/:id", verifyToken, updateUser);
router.delete("/:id", verifyToken, deleteUser);

export default router;

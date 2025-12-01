// src/backend/routes/clientsRoutes.ts
import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from "../controllers/clientsController";

const router = Router();

router.get("/", verifyToken, getClients);
router.get("/:id", verifyToken, getClientById);
router.post("/", verifyToken, createClient);
router.patch("/:id", verifyToken, updateClient);
router.delete("/:id", verifyToken, deleteClient);

export default router;

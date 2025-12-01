import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  listSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../controllers/suppliersController";

const router = Router();

router.get("/", verifyToken, listSuppliers);
router.get("/:id", verifyToken, getSupplier);
router.post("/", verifyToken, createSupplier);
router.patch("/:id", verifyToken, updateSupplier);
router.delete("/:id", verifyToken, deleteSupplier);

export default router;

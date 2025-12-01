import { Router } from "express";
import { verifyToken } from "../middleware/authMiddleware";
import {
  listManufacturers,
  getManufacturer,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer,
} from "../controllers/manufacturersController";

const router = Router();

router.get("/", verifyToken, listManufacturers);
router.get("/:id", verifyToken, getManufacturer);
router.post("/", verifyToken, createManufacturer);
router.patch("/:id", verifyToken, updateManufacturer);
router.delete("/:id", verifyToken, deleteManufacturer);

export default router;

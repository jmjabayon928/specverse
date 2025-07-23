// src/backend/routes/filledSheetRoutes.ts
import express from "express";
import { verifyToken } from "../middleware/authMiddleware";
import { requirePermission } from "../middleware/authMiddleware";
import * as controller from "../controllers/filledSheetController";
import { auditAction } from "../middleware/auditMiddleware";
import { exportFilledSheetPDF, exportFilledSheetExcel } from "../controllers/filledSheetController";

const router = express.Router();

router.get("/", verifyToken, requirePermission("DATASHEET_VIEW"), controller.getAllFilled);
router.get("/reference-options", verifyToken, requirePermission("DATASHEET_VIEW"), controller.getReferenceOptions);
router.post("/", verifyToken, requirePermission("DATASHEET_CREATE"), auditAction("Create Filled Sheet"), controller.createFilledSheetHandler);
router.get("/:id", verifyToken, requirePermission("DATASHEET_VIEW"), controller.getFilledSheetById);
router.put("/:id", verifyToken, requirePermission("DATASHEET_EDIT"), controller.updateFilledSheetHandler);
router.post("/:id/verify", verifyToken, requirePermission("DATASHEET_VERIFY"), controller.verifyFilledSheetHandler);
router.post("/:id/approve", verifyToken, requirePermission("DATASHEET_APPROVE"), controller.approveFilledSheetHandler);
router.get("/export/:id/pdf", verifyToken, requirePermission("DATASHEET_VIEW"), exportFilledSheetPDF);
router.get("/export/:id/excel", verifyToken, requirePermission("DATASHEET_VIEW"), exportFilledSheetExcel);

export default router;

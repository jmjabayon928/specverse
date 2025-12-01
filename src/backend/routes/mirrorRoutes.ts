// src/backend/routes/mirrorRoutes.ts
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { verifyToken } from "../middleware/authMiddleware";
import * as MirrorController from "@/backend/controllers/mirrorController";

const router = Router();

// local disk tmp for uploads
const upload = multer({ dest: path.join(process.cwd(), "tmp_uploads") });

// Learn (Excel) -> draft definition
router.post(
  "/templates/excel/learn",
  verifyToken,
  upload.single("file"),
  MirrorController.learnExcel
);

// Confirm & save definition (MVP: memory)
router.post(
  "/templates/confirm",
  verifyToken,
  MirrorController.confirmDefinition
);

// Apply definition -> generate workbook
router.post(
  "/templates/apply",
  verifyToken,
  MirrorController.applyDefinition
);

// Download generated file
router.get(
  "/templates/download/:name",
  verifyToken,
  MirrorController.downloadGenerated
);

// i18n: French -> (targets) save translations
router.post(
  "/i18n/translate-and-save",
  verifyToken,
  MirrorController.translateAndSave
);

export default router;

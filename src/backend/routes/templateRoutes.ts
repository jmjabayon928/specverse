// src/backend/routes/templateRoutes.ts

import express, { RequestHandler } from "express";
import { verifyToken, requirePermission } from "../middleware/authMiddleware";
import * as controller from "../controllers/templateController";
import { auditAction } from "../middleware/auditMiddleware";

const router = express.Router();

// Create Template
router.post(
  "/create",
  verifyToken,
  requirePermission("TEMPLATE_CREATE") as RequestHandler,
  auditAction("Create Template"),
  controller.createTemplateHandler
);

// Edit Template
router.put(
  "/:id",
  verifyToken,
  requirePermission("TEMPLATE_EDIT") as RequestHandler,
  auditAction("Edit Template"),
  controller.editTemplate
);

// Get Template Details
router.get(
  "/:id/detail",
  verifyToken,
  requirePermission("TEMPLATE_VIEW") as RequestHandler,
  controller.getTemplateDetail
);

// Verify Template
router.post(
  "/:id/verify",
  verifyToken,
  requirePermission("TEMPLATE_VERIFY") as RequestHandler,
  auditAction("Verify Template"),
  controller.verifyTemplateHandler
);

// Approve Template
router.post(
  "/:id/approve",
  verifyToken,
  requirePermission("TEMPLATE_APPROVE") as RequestHandler,
  auditAction("Approve Template"),
  controller.approveTemplateHandler
);

// Revise Template
router.post(
  "/:id/revise",
  verifyToken,
  requirePermission("TEMPLATE_REVISE") as RequestHandler,
  auditAction("Revise Template"),
  controller.reviseTemplate
);

// Delete Template
router.delete(
  "/:id",
  verifyToken,
  requirePermission("TEMPLATE_DELETE") as RequestHandler,
  auditAction("Delete Template"),
  controller.deleteTemplate
);

// Get All Templates
router.get(
  "/",
  verifyToken,
  requirePermission("TEMPLATES_VIEW") as RequestHandler,
  controller.getAllTemplates
);

// Get Reference Options
router.get(
  "/reference-options",
  verifyToken,
  controller.getTemplateReferenceOptions
);

router.get("/", verifyToken, controller.getAllTemplates);
router.get("/reference-options", verifyToken, controller.getTemplateReferenceOptions);

export default router;

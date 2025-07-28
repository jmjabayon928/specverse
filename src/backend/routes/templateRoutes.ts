import express, { RequestHandler } from "express";
import { verifyToken, requirePermission } from "../middleware/authMiddleware";
import * as controller from "../controllers/templateController";
import { auditAction } from "../middleware/auditMiddleware";

const router = express.Router();

// 🔹 Create Template
router.post(
  "/create",
  verifyToken,
  requirePermission("TEMPLATE_CREATE") as RequestHandler,
  auditAction("Create Template"),
  controller.createTemplateHandler
);

// 🔹 Edit Template
router.put(
  "/:id",
  verifyToken,
  requirePermission("TEMPLATE_EDIT") as RequestHandler,
  auditAction("Edit Template"),
  controller.editTemplate
);

// 🔹 Verify Template
router.post(
  "/:id/verify",
  verifyToken,
  requirePermission("TEMPLATE_VERIFY") as RequestHandler,
  auditAction("Verify Template"),
  controller.verifyTemplateHandler
);

// 🔹 Approve Template
router.post(
  "/:id/approve",
  verifyToken,
  requirePermission("TEMPLATE_APPROVE") as RequestHandler,
  auditAction("Approve Template"),
  controller.approveTemplateHandler
);

// 🔹 Revise Template
router.post(
  "/:id/revise",
  verifyToken,
  requirePermission("TEMPLATE_REVISE") as RequestHandler,
  auditAction("Revise Template"),
  controller.reviseTemplate
);

// 🔹 Delete Template
router.delete(
  "/:id",
  verifyToken,
  requirePermission("TEMPLATE_DELETE") as RequestHandler,
  auditAction("Delete Template"),
  controller.deleteTemplate
);

// 🔹 Export PDF
router.get(
  "/export/:id/pdf",
  verifyToken,
  controller.exportTemplatePDF
);

// 🔹 Export Excel
router.get(
  "/export/:id/excel",
  verifyToken,
  controller.exportTemplateExcel
);

// 🔹 View Template for Edit Page (no translation/uom)
router.get(
  "/:id/detail",
  verifyToken,
  requirePermission("TEMPLATE_VIEW") as RequestHandler,
  controller.getTemplateDetailForEdit
);

// 🔹 View Template with Translation + UOM (for public/detail view)
router.get(
  "/:id",
  verifyToken,
  requirePermission("TEMPLATE_VIEW") as RequestHandler,
  controller.getTemplateDetails
);

// 🔹 Get All Templates
router.get(
  "/",
  verifyToken,
  requirePermission("TEMPLATES_VIEW") as RequestHandler,
  controller.getAllTemplates
);

// 🔹 Reference Dropdowns
router.get(
  "/reference-options",
  verifyToken,
  controller.getTemplateReferenceOptions
);

export default router;

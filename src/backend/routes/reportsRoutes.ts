// src/backend/routes/reportsRoutes.ts
import express from "express";
import { PERMISSIONS } from "@/constants/permissions";
import { verifyToken, requirePermission } from "../middleware/authMiddleware";
import {
  getEstimationCostBreakdown,
  getVendorQuotesByEstimationId,
  getEstimateVsActualByEstimationId,
  getSupplierComparisonData,
  getInventoryForecastData,
  getInventoryContribution,
  getRejectedTemplatesData,
  getRejectedFilledSheetsOverTime,
  getTemplateWorkflowSankey,
  getFilledSheetWorkflowSankey,
} from "../controllers/reportsController";

const router = express.Router();

router.get("/estimation-cost", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getEstimationCostBreakdown);
router.get("/vendor-quotes", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getVendorQuotesByEstimationId);
router.get("/estimate-vs-actual", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getEstimateVsActualByEstimationId);
router.get("/supplier-comparison", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getSupplierComparisonData);
router.get("/inventory-forecast", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getInventoryForecastData);
router.get("/inventory-contribution", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getInventoryContribution);
router.get("/rejected-templates", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getRejectedTemplatesData);
router.get("/rejected-filledsheets", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getRejectedFilledSheetsOverTime);
router.get("/template-workflow-sankey", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getTemplateWorkflowSankey);
router.get("/filledsheet-workflow-sankey", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getFilledSheetWorkflowSankey);

export default router;

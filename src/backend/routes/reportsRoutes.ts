// src/backend/routes/reportsRoutes.ts
import express from "express";
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

router.get("/estimation-cost", verifyToken, requirePermission("DASHBOARD_VIEW"), getEstimationCostBreakdown);
router.get("/vendor-quotes", verifyToken, requirePermission("DASHBOARD_VIEW"), getVendorQuotesByEstimationId);
router.get("/estimate-vs-actual", verifyToken, requirePermission("DASHBOARD_VIEW"), getEstimateVsActualByEstimationId);
router.get("/supplier-comparison", verifyToken, requirePermission("DASHBOARD_VIEW"), getSupplierComparisonData);
router.get("/inventory-forecast", verifyToken, requirePermission("DASHBOARD_VIEW"), getInventoryForecastData);
router.get("/inventory-contribution", verifyToken, requirePermission("DASHBOARD_VIEW"), getInventoryContribution);
router.get("/rejected-templates", verifyToken, requirePermission("DASHBOARD_VIEW"), getRejectedTemplatesData);
router.get("/rejected-filledsheets", verifyToken, requirePermission("DASHBOARD_VIEW"), getRejectedFilledSheetsOverTime);
router.get("/template-workflow-sankey", verifyToken, requirePermission("DASHBOARD_VIEW"), getTemplateWorkflowSankey);
router.get("/filledsheet-workflow-sankey", verifyToken, requirePermission("DASHBOARD_VIEW"), getFilledSheetWorkflowSankey);

export default router;

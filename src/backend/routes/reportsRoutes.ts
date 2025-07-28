// src/backend/routes/reportsRoutes.ts
import express from "express";
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

router.get("/estimation-cost", getEstimationCostBreakdown);
router.get("/vendor-quotes", getVendorQuotesByEstimationId);
router.get("/estimate-vs-actual", getEstimateVsActualByEstimationId);
router.get("/supplier-comparison", getSupplierComparisonData);
router.get("/inventory-forecast", getInventoryForecastData);
router.get("/inventory-contribution", getInventoryContribution);
router.get("/rejected-templates", getRejectedTemplatesData);
router.get("/rejected-filledsheets", getRejectedFilledSheetsOverTime);
router.get("/template-workflow-sankey", getTemplateWorkflowSankey);
router.get("/filledsheet-workflow-sankey", getFilledSheetWorkflowSankey);

export default router;

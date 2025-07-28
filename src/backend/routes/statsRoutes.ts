// src/backend/routes/statsRoutes.ts
import express from "express";
import { 
  getDatasheetsByStatus,
  getTemplatesCreatedOverTime,
  pendingVerificationsHandler,
  activeUsersByRoleHandler,
  inventoryStockLevels,
  getEstimationTotals,
  fetchDatasheetLifecycleStats,
  fetchVerificationBottlenecks,
  fetchTemplateUsageTrends,
  fetchTeamPerformanceRadar,
  fetchFieldCompletionTrends
} from "../controllers/statsController";

const router = express.Router();

router.get("/datasheets-by-status", getDatasheetsByStatus);
router.get("/templates-over-time", getTemplatesCreatedOverTime);
router.get("/pending-verifications", pendingVerificationsHandler);
router.get("/active-users-by-role", activeUsersByRoleHandler);
router.get("/inventory-stock", inventoryStockLevels);
router.get("/estimation-totals", getEstimationTotals);
router.get("/datasheet-lifecycle", fetchDatasheetLifecycleStats);
router.get("/verification-bottlenecks", fetchVerificationBottlenecks);
router.get("/template-usage", fetchTemplateUsageTrends);
router.get("/team-performance", fetchTeamPerformanceRadar);
router.get("/field-completion", fetchFieldCompletionTrends);

export default router;

// src/backend/routes/statsRoutes.ts
import express from "express";
import { verifyToken, requirePermission } from "../middleware/authMiddleware";
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

router.get("/datasheets-by-status", verifyToken, requirePermission("DASHBOARD_VIEW"), getDatasheetsByStatus);
router.get("/templates-over-time", verifyToken, requirePermission("DASHBOARD_VIEW"), getTemplatesCreatedOverTime);
router.get("/pending-verifications", verifyToken, requirePermission("DASHBOARD_VIEW"), pendingVerificationsHandler);
router.get("/active-users-by-role", verifyToken, requirePermission("DASHBOARD_VIEW"), activeUsersByRoleHandler);
router.get("/inventory-stock", verifyToken, requirePermission("DASHBOARD_VIEW"), inventoryStockLevels);
router.get("/estimation-totals", verifyToken, requirePermission("DASHBOARD_VIEW"), getEstimationTotals);
router.get("/datasheet-lifecycle", verifyToken, requirePermission("DASHBOARD_VIEW"), fetchDatasheetLifecycleStats);
router.get("/verification-bottlenecks", verifyToken, requirePermission("DASHBOARD_VIEW"), fetchVerificationBottlenecks);
router.get("/template-usage", verifyToken, requirePermission("DASHBOARD_VIEW"), fetchTemplateUsageTrends);
router.get("/team-performance", verifyToken, requirePermission("DASHBOARD_VIEW"), fetchTeamPerformanceRadar);
router.get("/field-completion", verifyToken, requirePermission("DASHBOARD_VIEW"), fetchFieldCompletionTrends);

export default router;

// src/backend/routes/statsRoutes.ts
import express from "express";
import { PERMISSIONS } from "@/constants/permissions";
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

router.get("/datasheets-by-status", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getDatasheetsByStatus);
router.get("/templates-over-time", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getTemplatesCreatedOverTime);
router.get("/pending-verifications", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), pendingVerificationsHandler);
router.get("/active-users-by-role", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), activeUsersByRoleHandler);
router.get("/inventory-stock", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), inventoryStockLevels);
router.get("/estimation-totals", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), getEstimationTotals);
router.get("/datasheet-lifecycle", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), fetchDatasheetLifecycleStats);
router.get("/verification-bottlenecks", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), fetchVerificationBottlenecks);
router.get("/template-usage", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), fetchTemplateUsageTrends);
router.get("/team-performance", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), fetchTeamPerformanceRadar);
router.get("/field-completion", verifyToken, requirePermission(PERMISSIONS.DASHBOARD_VIEW), fetchFieldCompletionTrends);

export default router;

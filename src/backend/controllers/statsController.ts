// src/backend/controllers/statsController.ts
import { Request, Response } from "express";
import { 
  fetchDatasheetsByStatus,
  fetchTemplatesCreatedOverTime,
  getPendingVerifications,
  getActiveUsersByRole,
  getInventoryStockLevels,
  getEstimationTotalsByProject,
  getDatasheetLifecycleStats,
  getVerificationBottlenecks,
  getTemplateUsageTrends,
  getTeamPerformanceMetrics,
  getFieldCompletionTrends
} from "../services/statsService";

export const getDatasheetsByStatus = async (req: Request, res: Response) => {
  try {
    const data = await fetchDatasheetsByStatus();
    res.json(data);
  } catch (error) {
    console.error("Error fetching datasheets by status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getTemplatesCreatedOverTime = async (req: Request, res: Response) => {
  try {
    const data = await fetchTemplatesCreatedOverTime();
    res.json(data);
  } catch (error) {
    console.error("Error fetching templates over time:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const pendingVerificationsHandler = async (_req: Request, res: Response) => {
  try {
    const data = await getPendingVerifications();
    res.json(data);
  } catch (error) {
    console.error("Error fetching pending verifications:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const activeUsersByRoleHandler = async (_req: Request, res: Response) => {
  try {
    const data = await getActiveUsersByRole();
    res.json(data);
  } catch (error) {
    console.error("Error fetching active users by role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export async function inventoryStockLevels(req: Request, res: Response) {
  try {
    const data = await getInventoryStockLevels();
    res.json(data);
  } catch (error) {
    console.error("Error in inventoryStockLevels controller:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export const getEstimationTotals = async (req: Request, res: Response) => {
  try {
    const data = await getEstimationTotalsByProject();
    res.json(data);
  } catch (error) {
    console.error("Error fetching estimation totals:", error);
    res.status(500).json({ message: "Failed to fetch estimation totals" });
  }
};

export async function fetchDatasheetLifecycleStats(req: Request, res: Response) {
  try {
    const data = await getDatasheetLifecycleStats();
    res.json(data);
  } catch (error) {
    console.error("Error fetching datasheet lifecycle stats:", error);
    res.status(500).json({ error: "Failed to fetch datasheet lifecycle stats" });
  }
}

export async function fetchVerificationBottlenecks(req: Request, res: Response) {
  try {
    const data = await getVerificationBottlenecks();
    res.json(data);
  } catch (error) {
    console.error("Error fetching verification bottlenecks:", error);
    res.status(500).json({ error: "Failed to fetch verification bottlenecks" });
  }
}

export async function fetchTemplateUsageTrends(req: Request, res: Response) {
  try {
    const data = await getTemplateUsageTrends();
    res.json(data);
  } catch (error) {
    console.error("Error fetching template usage:", error);
    res.status(500).json({ error: "Failed to fetch template usage trends" });
  }
}

export async function fetchTeamPerformanceRadar(req: Request, res: Response) {
  try {
    const data = await getTeamPerformanceMetrics();
    res.json(data);
  } catch (error) {
    console.error("Error fetching team performance:", error);
    res.status(500).json({ error: "Failed to fetch team performance" });
  }
}

export async function fetchFieldCompletionTrends(req: Request, res: Response) {
  try {
    const data = await getFieldCompletionTrends();
    res.json(data);
  } catch (error) {
    console.error("Error fetching field completion trends:", error);
    res.status(500).json({ error: "Failed to fetch field completion trends" });
  }
}
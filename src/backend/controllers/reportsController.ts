// src/backend/controllers/reportsController.ts
import { Request, Response, RequestHandler } from "express";
import { 
  getEstimationCostBreakdownFromDB,
  getVendorQuotesFromDB, 
  getEstimateVsActualFromDB,
  getSupplierComparisonFromDB,
  getInventoryForecastFromDB,
  getInventoryContributionFromDB,
  fetchRejectedTemplatesFromDB,
  getRejectedFilledSheetsOverTimeFromDB,
  getTemplateWorkflowSankeyData,
  getFilledSheetWorkflowSankeyFromDB,
} from "../services/reportsService";

export const getEstimationCostBreakdown = async (req: Request, res: Response) => {
  try {
    const data = await getEstimationCostBreakdownFromDB();
    res.json(data);
  } catch (error) {
    console.error("Error in getEstimationCostBreakdown:", error);
    res.status(500).json({ error: "Failed to fetch estimation cost data" });
  }
};

export const getVendorQuotesByEstimationId: RequestHandler = async (req, res) => {
  const estimationId = parseInt(req.query.estimationId as string);
  if (isNaN(estimationId)) {
    res.status(400).json({ error: "Invalid EstimationID" });
    return;
  }

  try {
    const data = await getVendorQuotesFromDB(estimationId);
    res.json(data);
  } catch (error) {
    console.error("Error fetching vendor quotes:", error);
    res.status(500).json({ error: "Failed to fetch vendor quotes" });
  }
};

export const getEstimateVsActualByEstimationId: RequestHandler = async (req, res) => {
  const estimationId = parseInt(req.query.estimationId as string);

  if (isNaN(estimationId)) {
    res.status(400).json({ error: "Invalid EstimationID" });
    return;
  }

  try {
    const data = await getEstimateVsActualFromDB(estimationId);
    res.json(data);
  } catch (error) {
    console.error("Error in getEstimateVsActualByEstimationId:", error);
    res.status(500).json({ error: "Failed to fetch estimate comparison" });
  }
};

export const getSupplierComparisonData: RequestHandler = async (req, res) => {
  const estimationIdParam = req.query.estimationId;
  const estimationId = estimationIdParam ? parseInt(estimationIdParam as string) : null;

  try {
    const data = await getSupplierComparisonFromDB(estimationId);
    res.json(data);
  } catch (error) {
    console.error("Error in getSupplierComparisonData:", error);
    res.status(500).json({ error: "Failed to fetch supplier comparison data" });
  }
};

export const getInventoryForecastData: RequestHandler = async (req, res) => {
  try {
    const data = await getInventoryForecastFromDB();
    res.json(data);
  } catch (error) {
    console.error("Error in getInventoryForecastData:", error);
    res.status(500).json({ error: "Failed to fetch inventory forecast data" });
  }
};

export const getInventoryContribution: RequestHandler = async (req, res) => {
  try {
    const result = await getInventoryContributionFromDB();
    res.json(result);
  } catch (error) {
    console.error("Error in getInventoryContribution:", error);
    res.status(500).json({ error: "Failed to fetch inventory contribution data" });
  }
};

export const getRejectedTemplatesData: RequestHandler = async (req, res) => {
  try {
    const data = await fetchRejectedTemplatesFromDB();
    res.json(data);
  } catch (error) {
    console.error("Error in getRejectedTemplatesData:", error);
    res.status(500).json({ error: "Failed to fetch rejected templates data" });
  }
};

export const getRejectedFilledSheetsOverTime: RequestHandler = async (req, res) => {
  try {
    const data = await getRejectedFilledSheetsOverTimeFromDB();
    res.json(data);
  } catch (error) {
    console.error("Error fetching rejected filled sheets data:", error);
    res.status(500).json({ error: "Failed to fetch rejected filled sheets" });
  }
};

export const getTemplateWorkflowSankey: RequestHandler = async (req, res) => {
  try {
    const data = await getTemplateWorkflowSankeyData();
    res.json(data);
  } catch (error) {
    console.error("Error in getTemplateWorkflowSankey:", error);
    res.status(500).json({ error: "Failed to fetch template workflow data" });
  }
};

export const getFilledSheetWorkflowSankey: RequestHandler = async (req, res) => {
  try {
    const data = await getFilledSheetWorkflowSankeyFromDB();
    res.json(data);
  } catch (error) {
    console.error("Error in getFilledSheetWorkflowSankey:", error);
    res.status(500).json({ error: "Failed to fetch filled sheet workflow sankey data" });
  }
};
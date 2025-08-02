// src/backend/routes/estimationRoutes.ts
import express from "express";
import { verifyToken } from "../middleware/authMiddleware";
import * as controller from "../controllers/estimationController";

const router = express.Router();

// Reference dropdowns
router.get("/clients", verifyToken, controller.getClientListHandler);
router.get("/projects", verifyToken, controller.getProjectListHandler);

// Packages — placed before :id routes to prevent conflicts
router.get("/packages/all", verifyToken, controller.getAllPackagesHandler);
router.get("/packages", verifyToken, controller.getPackagesByEstimationIdHandler);
router.get("/packages/:id", verifyToken, controller.getPackageByIdHandler);
router.post("/packages/create", verifyToken, controller.createPackageHandler);
router.put("/packages/:id", verifyToken, controller.updatePackageHandler);
router.delete("/packages/:id", verifyToken, controller.deletePackageHandler);

// Items
router.get("/items", verifyToken, controller.getItemsByPackageIdHandler);
router.post("/items/create", verifyToken, controller.createItemHandler);
router.put("/items/:id", verifyToken, controller.updateItemHandler);
router.delete("/items/:id", verifyToken, controller.deleteItemHandler);

// Quotes
router.get("/quotes/all", verifyToken, controller.getAllQuotesHandler);
router.get("/quotes", verifyToken, controller.getQuotesByItemIdHandler);
router.post("/quotes/create", verifyToken, controller.createSupplierQuoteHandler);
router.post("/quotes/select/:quoteId", verifyToken, controller.selectWinningQuoteHandler);
router.put("/quotes/:id", verifyToken, controller.updateSupplierQuoteHandler);
router.delete("/quotes/:id", verifyToken, controller.deleteSupplierQuoteHandler);

// Estimation CRUD
router.get("/", verifyToken, controller.getAllEstimationsHandler);
router.post("/", verifyToken, controller.createEstimationHandler);
router.get("/history", verifyToken, controller.getPastEstimationsHandler);
router.get("/:id", verifyToken, controller.getEstimationByIdHandler);
router.put("/:id", verifyToken, controller.updateEstimationHandler);
router.delete("/:id", verifyToken, controller.deleteEstimationHandler);

// Filter + Export
router.post("/filter", verifyToken, controller.getFilteredEstimationsHandler);
router.post("/export/filter/pdf", verifyToken, controller.exportFilteredEstimationsPDFHandler);

// PDF Exports
router.get("/export/:id/pdf", verifyToken, controller.exportEstimationPDFHandler);
router.get("/export/:id/summary-pdf", verifyToken, controller.exportEstimationSummaryPDFHandler);
router.get("/export/estimation-procurement/:id/pdf", verifyToken, controller.exportEstimationProcurementPDFHandler);
router.get("/export/package-procurement/:packageId/pdf", verifyToken, controller.exportPackageProcurementPDFHandler);

// Excel Exports
router.get("/export/:id/excel", verifyToken, controller.exportEstimationExcelHandler);
router.get("/export/:id/summary-excel", verifyToken, controller.exportEstimationSummaryExcelHandler);
router.get("/export/estimation-procurement/:id/excel", verifyToken, controller.exportEstimationProcurementExcelHandler);
router.get("/export/package-procurement/:packageId/excel", verifyToken, controller.exportPackageProcurementExcelHandler);

export default router;

// src/backend/controllers/estimationController.ts
import { RequestHandler } from "express";
import { poolPromise, sql } from "../config/db";
import {
  getAllEstimations,
  getEstimationById,
  createEstimation,
  updateEstimation,
  getFilteredEstimationsWithPagination
} from "../database/estimationQueries";
import {
  //getPackagesByEstimationId,
  getAllPackages,
  getPackageById,
  createPackage,
  updatePackage,
  deletePackage,
  //isDuplicatePackageName
} from "../database/estimationPackageQueries";
import {
  //getItemsByPackageId,
  createItem,
  //isDuplicateItem
} from "../database/estimationItemQueries";
import {
  getQuotesByItemId,
  createSupplierQuote,
  selectSupplierQuote,
  //isDuplicateQuote
} from "../database/estimationQuoteQueries";
import {
  generateEstimationPDF,
  generateEstimationSummaryPDF,
  generatePackageProcurementPDF,
  generateEstimationProcurementPDF,
  generateEstimationExcel,
  generateEstimationSummaryExcel,
  generatePackageProcurementExcel,
  generateEstimationProcurementExcel,
  generateFilteredEstimationPDF
} from "../services/estimationExportService";

// ========================
// CRUD
// ========================
export const getAllEstimationsHandler: RequestHandler = async (req, res) => {
  const data = await getAllEstimations();
  res.json(data);
};

export const createEstimationHandler: RequestHandler = async (req, res) => {
  try {
    const data = await createEstimation(req.body);
    res.status(201).json(data);
  } catch (err) {
    console.error("❌ createEstimation failed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getEstimationByIdHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid EstimationID" });
      return;
    }

    const data = await getEstimationById(id);

    if (!data) {
      res.status(404).json({ error: "Estimation not found" });
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getEstimationByIdHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateEstimationHandler: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid EstimationID" });
      return;
    }

    const data = await updateEstimation(id, req.body);
    res.json(data);
  } catch (error) {
    console.error("Error in updateEstimationHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteEstimationHandler: RequestHandler = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid EstimationID" });
      return;
    }

    const pool = await poolPromise;
    await pool
      .request()
      .input("EstimationID", sql.Int, id)
      .query("DELETE FROM Estimations WHERE EstimationID = @EstimationID");

    res.status(204).send();
  } catch (error) {
    console.error("Error in deleteEstimationHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========================
// Export
// ========================
export const exportEstimationPDFHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id);
  const buffer = await generateEstimationPDF(id);
  res.setHeader("Content-Type", "application/pdf");
  res.send(buffer);
};

export const exportEstimationSummaryPDFHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id);
  const buffer = await generateEstimationSummaryPDF(id);
  res.setHeader("Content-Type", "application/pdf");
  res.send(buffer);
};

export const exportEstimationProcurementPDFHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id);
  const buffer = await generateEstimationProcurementPDF(id);
  res.setHeader("Content-Type", "application/pdf");
  res.send(buffer);
};

export const exportPackageProcurementPDFHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.packageId);
  const buffer = await generatePackageProcurementPDF(id);
  res.setHeader("Content-Type", "application/pdf");
  res.send(buffer);
};

export const exportEstimationExcelHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id);
  const buffer = await generateEstimationExcel(id);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};

export const exportEstimationSummaryExcelHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id);
  const buffer = await generateEstimationSummaryExcel(id);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};

export const exportEstimationProcurementExcelHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.id);
  const buffer = await generateEstimationProcurementExcel(id);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};

export const exportPackageProcurementExcelHandler: RequestHandler = async (req, res) => {
  const id = parseInt(req.params.packageId);
  const buffer = await generatePackageProcurementExcel(id);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
};

export const exportFilteredEstimationsPDFHandler: RequestHandler = async (req, res) => {
  try {
    const { statuses, clients, projects, search } = req.body;

    const buffer = await generateFilteredEstimationPDF(statuses, clients, projects, search);
    res.setHeader("Content-Type", "application/pdf");
    res.send(buffer);
  } catch (error) {
    console.error("Error generating filtered estimation PDF:", error);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
};

// ========================
// Filter
// ========================
export const getFilteredEstimationsHandler: RequestHandler = async (req, res) => {
  try {
    const {
      statuses = [],
      clients = [],
      projects = [],
      search = "",
      page = 1,
      pageSize = 10
    } = req.body;

    const { estimations, totalCount } = await getFilteredEstimationsWithPagination(
      statuses,
      clients,
      projects,
      search,
      page,
      pageSize
    );

    res.json({ data: estimations, totalCount });
  } catch (error) {
    console.error("Error in getFilteredEstimationsHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========================
// Packages
// ========================
export const getAllPackagesHandler: RequestHandler = async (_req, res) => {
  try {
    const data = await getAllPackages();
    res.json(data);
  } catch (err) {
    console.error("Error in getAllPackagesHandler:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getPackagesByEstimationIdHandler: RequestHandler = async (req, res): Promise<void> => {
  try {
    let raw = req.query.estimationId;

    // Handle array or ParsedQs
    if (Array.isArray(raw)) raw = raw[0];
    if (typeof raw !== "string") {
      res.status(400).json({ error: "Invalid EstimationID" });
      return;
    }

    const estimationId = parseInt(raw, 10);
    if (isNaN(estimationId) || estimationId <= 0) {
      res.status(400).json({ error: "Invalid EstimationID" });
      return;
    }

    const pool = await poolPromise;
    const result = await pool.request()
      .input("EstimationID", sql.Int, estimationId)
      .query(`
        SELECT 
          p.PackageID,
          p.EstimationID,
          p.PackageName,
          p.Description,
          p.TotalMaterialCost,
          p.TotalLaborCost,
          p.TotalDurationDays,
          p.CreatedAt,
          p.CreatedBy,
          cb.FirstName + ' ' + cb.LastName AS CreatedByName,
          p.ModifiedAt,
          p.ModifiedBy,
          mb.FirstName + ' ' + mb.LastName AS ModifiedByName
        FROM EstimationPackages p
        LEFT JOIN Users cb ON p.CreatedBy = cb.UserID
        LEFT JOIN Users mb ON p.ModifiedBy = mb.UserID
        WHERE p.EstimationID = @EstimationID
        ORDER BY p.PackageID
      `);

    res.status(200).json(result.recordset);
  } catch (err) {
    console.error("❌ Error fetching packages:", err);
    res.status(500).json({ error: "Failed to fetch packages" });
  }
};

export const getPackageByIdHandler: RequestHandler = async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid PackageID" });
      return;
    }

    const data = await getPackageById(packageId);
    res.json(data);
  } catch (error) {
    console.error("Error in getPackageByIdHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createPackageHandler: RequestHandler = async (req, res) => {
  const data = await createPackage(req.body);
  res.status(201).json(data);
};

export const updatePackageHandler: RequestHandler = async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid PackageID" });
      return;
    }

    const data = await updatePackage(packageId, req.body);
    res.json(data);
  } catch (error) {
    console.error("Error in updatePackageHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const deletePackageHandler: RequestHandler = async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    if (!packageId) {
      res.status(400).json({ error: "Invalid PackageID" });
      return;
    }

    const data = await deletePackage(packageId);
    res.json(data);
  } catch (error) {
    console.error("Error in deletePackageHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ========================
// Items
// ========================
export const getItemsByPackageIdHandler: RequestHandler = async (req, res) => {
  const packageId = parseInt(req.query.packageId as string);
  if (isNaN(packageId)) {
    res.status(400).json({ message: "Invalid package ID" });
    return;
  }

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input("PackageID", sql.Int, packageId)
      .query(`
        SELECT 
          ei.EItemID,
          ei.EstimationID,
          ei.PackageID,
          ei.ItemID,
          ei.Quantity,
          ei.Description,
          ei.EstimatedUnitCost,
          ei.CreatedBy,
          ei.CreatedAt,
          u.FirstName + ' ' + u.LastName AS CreatedByName,
          i.ItemName,
          i.UnitCost
        FROM EstimationItems ei
        LEFT JOIN InventoryItems i ON ei.ItemID = i.InventoryItemID
        LEFT JOIN Users u ON ei.CreatedBy = u.UserID
        WHERE ei.PackageID = @PackageID
      `);

    res.json(result.recordset); // ✅ Do not return this — just respond
  } catch (err) {
    console.error("Error fetching items by package:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const createItemHandler: RequestHandler = async (req, res) => {
  const data = await createItem(req.body);
  res.status(201).json(data);
};

export const updateItemHandler: RequestHandler = async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    const { Quantity, Description } = req.body;

    if (isNaN(itemId)) {
      res.status(400).json({ message: "Invalid item ID" });
      return;
    }

    const pool = await poolPromise;
    await pool.request()
      .input("EItemID", sql.Int, itemId)
      .input("Quantity", sql.Int, Quantity)
      .input("Description", sql.NVarChar(1000), Description)
      .query(`
        UPDATE EstimationItems
        SET Quantity = @Quantity,
            Description = @Description
        WHERE EItemID = @EItemID
      `);

    res.status(200).json({ message: "Estimation item updated" });
  } catch (error) {
    console.error("❌ Error updating item:", error);
    res.status(500).json({ message: "Failed to update item" });
  }
};

export const deleteItemHandler: RequestHandler = async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId);
    if (isNaN(itemId)) {
      res.status(400).json({ message: "Invalid item ID" });
      return;
    }

    const pool = await poolPromise;
    await pool.request()
      .input("EItemID", sql.Int, itemId)
      .query("DELETE FROM EstimationItems WHERE EItemID = @EItemID");

    res.status(200).json({ message: "Estimation item deleted" });
  } catch (error) {
    console.error("❌ Error deleting item:", error);
    res.status(500).json({ message: "Failed to delete item" });
  }
};

// ========================
// Quotes
// ========================
export const getAllQuotesHandler: RequestHandler = async (req, res) => {
  try {
    const pool = await poolPromise;

    const result = await pool.request().query(`
      SELECT TOP (100)
        q.QuoteID,
        q.ItemID,
        q.SupplierID,
        q.QuotedUnitCost,
        q.ExpectedDeliveryDays,
        q.CurrencyCode,
        q.IsSelected,
        q.Notes,
        s.SupplierQuoteReference,
        s.TotalQuotedCost,
        s.CurrencyCode AS SupplierCurrency,
        s.ExpectedDeliveryDays AS SupplierDeliveryDays,
        i.ItemName,
        sup.SuppName AS SupplierName
      FROM EstimationItemSupplierQuotes q
        LEFT JOIN EstimationItems ei ON q.ItemID = ei.ItemID
        LEFT JOIN EstimationSuppliers s ON q.SupplierID = s.SupplierID AND ei.EstimationID = s.EstimationID
        LEFT JOIN InventoryItems i ON q.ItemID = i.InventoryItemID
        LEFT JOIN Suppliers sup ON q.SupplierID = sup.SuppID
    `);

    const quotes = result.recordset.map((row) => ({
      QuoteID: row.QuoteID,
      ItemID: row.ItemID,
      SupplierID: row.SupplierID,
      QuotedUnitCost: row.QuotedUnitCost,
      ExpectedDeliveryDays: row.ExpectedDeliveryDays,
      CurrencyCode: row.CurrencyCode,
      IsSelected: row.IsSelected,
      Notes: row.Notes,
      SupplierQuoteReference: row.SupplierQuoteReference,
      TotalQuotedCost: row.TotalQuotedCost,
      SupplierCurrency: row.SupplierCurrency,
      SupplierDeliveryDays: row.SupplierDeliveryDays,
      ItemName: row.ItemName,
      SupplierName: row.SupplierName,
    }));

    res.json(quotes);
  } catch (err) {
    console.error("Failed to load all quotes:", err);
    res.status(500).json({ error: "Failed to load quotes" });
  }
};

export const getPastEstimationsHandler: RequestHandler = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT 
        e.EstimationID,
        e.Title AS EstimationName,
        e.CreatedBy,
        u.FirstName + ' ' + u.LastName AS EstimatorName,
        e.CreatedAt,
        (ISNULL(e.TotalMaterialCost, 0) + ISNULL(e.TotalLaborCost, 0)) AS TotalEstimatedCost,
        COUNT(DISTINCT ei.EItemID) AS ItemCount,
        MAX(eq.ModifiedAt) AS LastModified
      FROM Estimations e
        LEFT JOIN Users u ON e.CreatedBy = u.UserID
        LEFT JOIN EstimationItems ei ON e.EstimationID = ei.EstimationID
        LEFT JOIN EstimationItemSupplierQuotes eq ON ei.ItemID = eq.ItemID
      GROUP BY 
        e.EstimationID,
        e.Title,
        e.CreatedBy,
        u.FirstName,
        u.LastName,
        e.CreatedAt,
        e.TotalMaterialCost,
        e.TotalLaborCost
      ORDER BY e.CreatedAt DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Failed to fetch past estimations:", err);
    res.status(500).json({ message: "Failed to load past estimations" });
  }
};

export const getQuotesByItemIdHandler: RequestHandler = async (req, res) => {
  try {
    const itemId = parseInt(req.query.itemId as string);
    if (!itemId) {
      res.status(400).json({ error: "Missing itemId" });
      return;
    }

    const data = await getQuotesByItemId(itemId);
    res.json(data);
  } catch (error) {
    console.error("Error in getQuotesByItemIdHandler:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const createSupplierQuoteHandler: RequestHandler = async (req, res) => {
  const data = await createSupplierQuote(req.body);
  res.status(201).json(data);
};

export const updateSupplierQuoteHandler: RequestHandler = async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    const {
      QuotedUnitCost,
      ExpectedDeliveryDays,
      CurrencyCode,
      Notes,
      SupplierQuoteReference
    } = req.body;

    if (isNaN(quoteId)) {
      res.status(400).json({ message: "Invalid quote ID" });
      return;
    }

    const pool = await poolPromise;
    await pool.request()
      .input("QuoteID", sql.Int, quoteId)
      .input("QuotedUnitCost", sql.Decimal(18, 2), QuotedUnitCost)
      .input("ExpectedDeliveryDays", sql.Int, ExpectedDeliveryDays)
      .input("CurrencyCode", sql.VarChar(10), CurrencyCode)
      .input("Notes", sql.NVarChar(1000), Notes)
      .input("SupplierQuoteReference", sql.NVarChar(255), SupplierQuoteReference)
      .query(`
        UPDATE EstimationItemSupplierQuotes
        SET 
          QuotedUnitCost = @QuotedUnitCost,
          ExpectedDeliveryDays = @ExpectedDeliveryDays,
          CurrencyCode = @CurrencyCode,
          Notes = @Notes,
          SupplierQuoteReference = @SupplierQuoteReference
        WHERE QuoteID = @QuoteID
      `);

    res.status(200).json({ message: "Supplier quote updated" });
  } catch (err) {
    console.error("❌ updateSupplierQuoteHandler error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteSupplierQuoteHandler: RequestHandler = async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      res.status(400).json({ message: "Invalid quote ID" });
      return;
    }

    const pool = await poolPromise;
    await pool.request()
      .input("QuoteID", sql.Int, quoteId)
      .query("DELETE FROM EstimationItemSupplierQuotes WHERE QuoteID = @QuoteID");

    res.status(200).json({ message: "Supplier quote deleted" });
  } catch (error) {
    console.error("❌ Error deleting supplier quote:", error);
    res.status(500).json({ message: "Failed to delete quote" });
  }
};

export const selectWinningQuoteHandler: RequestHandler = async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    if (isNaN(quoteId)) {
      res.status(400).json({ message: "Invalid quote ID" });
      return;
    }

    await selectSupplierQuote(quoteId);
    res.status(200).json({ message: "Quote awarded successfully" });
  } catch (error) {
    console.error("❌ Error awarding quote:", error);
    res.status(500).json({ message: "Failed to award quote" });
  }
};

export const getClientListHandler: RequestHandler = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT ClientID, ClientName
    FROM Clients
    ORDER BY ClientName
  `);
  res.json(result.recordset);
};

export const getProjectListHandler: RequestHandler = async (req, res) => {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT ProjectID, ProjectName
    FROM Projects
    ORDER BY ProjectName
  `);
  res.json(result.recordset);
};
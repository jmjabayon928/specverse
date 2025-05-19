import express from "express";
import { poolPromise, sql } from "../config/db";
import { updatePackage, deletePackage } from "../database/estimationPackageQueries";
import {
  getAllEstimations,
  getEstimationById,
  createEstimation,
  updateEstimation
} from "../database/estimationQueries";
import {
  getPackagesByEstimationId,
  getPackageById,
  createPackage
} from "../database/estimationPackageQueries";
import {
  getItemsByPackageId,
  createItem
} from "../database/estimationItemQueries";
import {
  getQuotesByItemId,
  createSupplierQuote,
  selectSupplierQuote
} from "../database/estimationQuoteQueries";

const router = express.Router();

// GET /api/estimation (All estimations)
router.get("/", async (req, res) => {
  try {
    const data = await getAllEstimations();
    res.json(data);
  } catch (err) {
    console.error("Error fetching estimations:", err);
    res.status(500).json({ error: "Failed to fetch estimations" });
  }
});

// POST /api/estimation (Create new estimation)
router.post("/", async (req, res) => {
  try {
    const data = await createEstimation(req.body);
    res.status(201).json(data);
  } catch (err) {
    console.error("Insert failed:", err);
    res.status(500).json({ error: "Failed to create estimation" });
  }
});

// ==============================
// Most specific routes
// ==============================

// GET /api/estimation/items?packageId=1
router.get("/items", async (req, res) => {
  try {
    const packageId = parseInt(req.query.packageId as string);
    const items = await getItemsByPackageId(packageId);
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load items" });
  }
});

// GET /api/estimation/packages?estimationId=1
router.get("/packages", async (req, res) => {
  try {
    const rawId = req.query.estimationId;
    if (!rawId || isNaN(Number(rawId))) {
      return res.status(400).json({ error: "Invalid EstimationID" });
    }

    const estimationId = parseInt(rawId as string);
    const packages = await getPackagesByEstimationId(estimationId);
    res.json(packages);
  } catch (err) {
    console.error("Error loading packages:", err);
    res.status(500).json({ error: "Failed to load packages" });
  }
});

// GET /api/estimation/packages/:id
router.get("/packages/:id", async (req, res) => {
  try {
    const packageId = parseInt(req.params.id);
    const pkg = await getPackageById(packageId);
    res.json(pkg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load package" });
  }
});

// GET /api/estimation/quotes?itemId=123
router.get("/quotes", async (req, res) => {
  try {
    const rawId = req.query.itemId;
    const itemId = parseInt(rawId as string);

    if (!itemId || isNaN(itemId)) {
      return res.status(400).json({ error: "Invalid ItemID" });
    }

    const quotes = await getQuotesByItemId(itemId);
    res.json(quotes);
  } catch (err) {
    console.error("Error fetching supplier quotes:", err);
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

// ==============================
// Create, update, delete
// ==============================

// POST /api/estimation/quotes/create
router.post("/quotes/create", async (req, res) => {
  try {
    const newQuote = req.body;
    const createdId = await createSupplierQuote(newQuote);
    res.status(201).json({ QuoteID: createdId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create supplier quote" });
  }
});

// POST /api/estimation/quotes/select/:quoteId
router.post("/quotes/select/:quoteId", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.quoteId);
    const pool = await poolPromise;

    // Get quote details
    const quoteResult = await pool.request()
      .input("QuoteID", sql.Int, quoteId)
      .query(`SELECT ItemID, QuotedUnitCost FROM EstimationItemSupplierQuotes WHERE QuoteID = @QuoteID`);
    
    const quote = quoteResult.recordset[0];
    if (!quote) return res.status(404).json({ error: "Quote not found" });

    const itemId = quote.ItemID;
    const cost = quote.QuotedUnitCost;

    // Get related package and estimation
    const itemResult = await pool.request()
      .input("EItemID", sql.Int, itemId)
      .query(`SELECT PackageID, EstimationID FROM EstimationItems WHERE EItemID = @EItemID`);
    
    const item = itemResult.recordset[0];
    if (!item) return res.status(404).json({ error: "Item not found" });

    const { PackageID, EstimationID } = item;

    // Set all other quotes for this item to not selected
    await pool.request()
      .input("ItemID", sql.Int, itemId)
      .query(`UPDATE EstimationItemSupplierQuotes SET IsSelected = 0 WHERE ItemID = @ItemID`);

    // Set this quote to selected
    await pool.request()
      .input("QuoteID", sql.Int, quoteId)
      .query(`UPDATE EstimationItemSupplierQuotes SET IsSelected = 1 WHERE QuoteID = @QuoteID`);

    // Update package material cost (sum of selected quotes for all its items)
    await pool.request()
      .input("PackageID", sql.Int, PackageID)
      .query(`
        UPDATE EstimationPackages
        SET TotalMaterialCost = (
          SELECT SUM(q.QuotedUnitCost)
          FROM EstimationItems i
          JOIN EstimationItemSupplierQuotes q ON q.ItemID = i.EItemID
          WHERE i.PackageID = @PackageID AND q.IsSelected = 1
        )
        WHERE PackageID = @PackageID
      `);

    // Update overall estimation cost
    await pool.request()
      .input("EstimationID", sql.Int, EstimationID)
      .query(`
        UPDATE Estimations
        SET TotalMaterialCost = (
          SELECT SUM(TotalMaterialCost)
          FROM EstimationPackages
          WHERE EstimationID = @EstimationID
        )
        WHERE EstimationID = @EstimationID
      `);

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to select supplier quote:", err);
    res.status(500).json({ error: "Failed to select supplier quote" });
  }
});

// Update a supplier quote by QuoteID
router.put('/quotes/:id', async (req, res) => {
  const { id } = req.params;
  const { SupplierID, QuotedUnitCost, ExpectedDeliveryDays, CurrencyCode, Notes } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('QuoteID', sql.Int, id)
      .input('SupplierID', sql.Int, SupplierID)
      .input('QuotedUnitCost', sql.Decimal(18, 2), QuotedUnitCost)
      .input('ExpectedDeliveryDays', sql.Int, ExpectedDeliveryDays || null)
      .input('CurrencyCode', sql.NVarChar(10), CurrencyCode || null)
      .input('Notes', sql.NVarChar(sql.MAX), Notes || null)
      .query(`
        UPDATE EstimationItemSupplierQuotes
        SET
          SupplierID = @SupplierID,
          QuotedUnitCost = @QuotedUnitCost,
          ExpectedDeliveryDays = @ExpectedDeliveryDays,
          CurrencyCode = @CurrencyCode,
          Notes = @Notes,
          ModifiedAt = GETDATE()
        WHERE QuoteID = @QuoteID
      `);

    res.status(200).json({ message: 'Quote updated successfully' });
  } catch (err) {
    console.error('Error updating quote:', err);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

router.delete("/quotes/:id", async (req, res) => {
  try {
    const quoteId = parseInt(req.params.id);
    if (!quoteId) return res.status(400).json({ error: "Invalid QuoteID" });

    const pool = await poolPromise;

    // Check if the quote is selected
    const check = await pool.request()
      .input("QuoteID", sql.Int, quoteId)
      .query(`SELECT IsSelected FROM EstimationItemSupplierQuotes WHERE QuoteID = @QuoteID`);

    if (!check.recordset[0]) {
      return res.status(404).json({ error: "Quote not found" });
    }

    if (check.recordset[0].IsSelected) {
      return res.status(400).json({ error: "Cannot delete a selected (winning) quote." });
    }

    // Proceed to delete
    await pool.request()
      .input("QuoteID", sql.Int, quoteId)
      .query(`DELETE FROM EstimationItemSupplierQuotes WHERE QuoteID = @QuoteID`);

    res.json({ success: true });
  } catch (err) {
    console.error("Failed to delete quote:", err);
    res.status(500).json({ error: "Failed to delete quote" });
  }
});

// POST /api/estimation/packages/create
router.post("/packages/create", async (req, res) => {
  try {
    const newPackage = req.body;
    const createdId = await createPackage(newPackage);
    res.status(201).json({ PackageID: createdId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create package" });
  }
});

// PUT /api/backend/estimation/packages/:id
router.put("/packages/:id", async (req, res) => {
  const packageId = parseInt(req.params.id);
  if (!packageId) {
    return res.status(400).json({ error: "Invalid PackageID" });
  }

  try {
    const updated = await updatePackage(packageId, req.body);
    res.json(updated);
  } catch (err) {
    console.error("Error updating package:", err);
    res.status(500).json({ error: "Failed to update package" });
  }
});

// Delete package
router.delete("/packages/:id", async (req, res) => {
  const packageId = parseInt(req.params.id);

  if (!packageId) {
    return res.status(400).json({ error: "Invalid PackageID" });
  }

  try {
    // ✅ Check for existing items
    const items = await getItemsByPackageId(packageId);
    if (items.length > 0) {
      return res.status(400).json({ error: "Cannot delete a package with existing items." });
    }

    await deletePackage(packageId); 
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to delete package:", err);
    res.status(500).json({ error: "Failed to delete package" });
  }
});

// POST /api/estimation/items/create
router.post("/items/create", async (req, res) => {
  try {
    const newItem = req.body;
    const createdId = await createItem(newItem);
    res.status(201).json({ ItemID: createdId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create item" });
  }
});

router.put('/items/:id', async (req, res) => {
  const { id } = req.params;
  const { ItemID, Quantity, Description, EstimationID, PackageID } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('EItemID', sql.Int, id)
      .input('ItemID', sql.Int, ItemID)
      .input('Quantity', sql.Int, Quantity)
      .input('Description', sql.NVarChar, Description || null)
      .input('EstimationID', sql.Int, EstimationID)
      .input('PackageID', sql.Int, PackageID)
      .query(`
        UPDATE EstimationItems
        SET
          ItemID = @ItemID,
          Quantity = @Quantity,
          Description = @Description,
          EstimationID = @EstimationID,
          PackageID = @PackageID,
          ModifiedAt = GETDATE()
        WHERE EItemID = @EItemID
      `);

    res.status(200).json({ message: 'Item updated' });
  } catch (err) {
    console.error('Failed to update item:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete("/items/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid EItemID" });

    // Check if item has quotes
    const pool = await poolPromise;
    const quoteCheck = await pool.request()
      .input("EItemID", sql.Int, id)
      .query(`SELECT COUNT(*) AS Total FROM EstimationItemSupplierQuotes WHERE ItemID = @EItemID`);

    if (quoteCheck.recordset[0].Total > 0) {
      return res.status(400).json({ error: "Cannot delete item with supplier quotes." });
    }

    await pool.request()
      .input("EItemID", sql.Int, id)
      .query(`DELETE FROM EstimationItems WHERE EItemID = @EItemID`);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete item error:", err);
    res.status(500).json({ error: "Failed to delete item" });
  }
});

// ==============================
// catch all
// ==============================

// GET /api/estimation/:id (Get one estimation)
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid EstimationID" });

  try {
    const data = await getEstimationById(id);
    res.json(data);
  } catch (err) {
    console.error("Error fetching estimation:", err);
    res.status(500).json({ error: "Failed to load estimation" });
  }
});

// PUT /api/estimation/:id (Update estimation)
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid EstimationID" });

  try {
    const data = await updateEstimation(id, req.body);
    res.json(data);
  } catch (err) {
    console.error("Error updating estimation:", err);
    res.status(500).json({ error: "Failed to update estimation" });
  }
});

// DELETE /api/backend/estimation/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!id) return res.status(400).json({ error: "Invalid EstimationID" });

  try {
    const pool = await poolPromise;
    await pool.request()
      .input("EstimationID", sql.Int, id)
      .query(`DELETE FROM Estimations WHERE EstimationID = @EstimationID`);
    res.status(204).send();
  } catch (err) {
    console.error("Error deleting estimation:", err);
    res.status(500).json({ error: "Failed to delete estimation" });
  }
});

export default router;

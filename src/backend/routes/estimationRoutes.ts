import express from "express";
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

// ==============================
// REST-STYLE ESTIMATION ROUTES
// ==============================

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

// ==============================
// PACKAGE ROUTES
// ==============================

// GET /api/estimation/packages?estimationId=1
router.get("/packages", async (req, res) => {
  try {
    const estimationId = parseInt(req.query.estimationId as string);
    const packages = await getPackagesByEstimationId(estimationId);
    res.json(packages);
  } catch (err) {
    console.error(err);
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

// ==============================
// ITEM ROUTES
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

// ==============================
// SUPPLIER QUOTES ROUTES
// ==============================

// GET /api/estimation/quotes?itemId=123
router.get("/quotes", async (req, res) => {
  try {
    const itemId = parseInt(req.query.itemId as string);
    const quotes = await getQuotesByItemId(itemId);
    res.json(quotes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load quotes" });
  }
});

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
    await selectSupplierQuote(quoteId);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to select supplier quote" });
  }
});

export default router;

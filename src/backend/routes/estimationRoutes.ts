import express from "express";
import {
    getAllEstimations,
    getEstimationById,
    createEstimation
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
// MAIN ESTIMATION ROUTES
// ==============================

// GET all estimations
router.get("/all", async (req, res) => {
    try {
        const data = await getAllEstimations();
        res.json(data);
    } catch (error) {
        console.error("Error fetching estimations:", error);
        res.status(500).json({ error: "Failed to load estimations" });
    }
});

// POST create new estimation
router.post("/create", async (req, res) => {
    try {
        const newEstimation = req.body;
        const createdId = await createEstimation(newEstimation);
        res.status(201).json({ EstimationID: createdId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create estimation" });
    }
});


// ==============================
// PACKAGES ROUTES
// ==============================

// GET all packages for an estimation
router.get("/packages", async (req, res) => {
    try {
        const estimationId = parseInt(req.query.estimationId as string);
        console.log("Fetching packages for estimation:", estimationId);

        const packages = await getPackagesByEstimationId(estimationId);
        console.log("Packages fetched from DB:", packages); // ← NEW LOG
        res.json(packages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load packages" });
    }
});

// GET single package by ID
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

// POST create package
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
// ITEMS ROUTES
// ==============================

// GET all items for a package
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

// POST create item
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

// GET all quotes for an item
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

// POST create supplier quote
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

// POST select a supplier quote
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

// GET single estimation by ID
router.get("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = await getEstimationById(id);
        res.json(data);
    } catch (error) {
        console.error("Error fetching estimation:", error);
        res.status(500).json({ error: "Failed to load estimation" });
    }
});

export default router;

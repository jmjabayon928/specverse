import express from "express";
import {
  getAllInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  softDeleteInventoryItem
} from "../database/inventoryQueries";

import {
  getInventoryTransactions,
  addInventoryTransaction
} from "../database/inventoryTransactionQueries";

import {
  getInventoryMaintenanceLogs,
  addInventoryMaintenanceLog
} from "../database/inventoryMaintenanceQueries";

import {
  getInventoryAuditLogs
} from "../database/inventoryAuditQueries";

import { verifyToken, requirePermission } from "../middleware/authMiddleware";
import { getAllReferenceOptions } from "@/backend/database/ReferenceQueries";
import { asyncHandler } from "@/backend/utils/asyncHandler";
import { getInventoryItemOptions } from '../database/ReferenceQueries';

const router = express.Router();

/*
FIXED ROUTES
*/
// This endpoint is used to fetch reference data for dropdowns and other UI elements
router.get("/reference-options", async (req, res) => {
  try {
    const data = await getAllReferenceOptions();
    res.json({
      categories: data.categories.map((c: { id: number; name: string }) => ({
        categoryId: c.id,
        CategoryName: c.name
      })),
      manufacturers: data.manufacturers.map((m: { id: number; name: string }) => ({
        manuId: m.id,
        manuName: m.name
      })),
      suppliers: data.suppliers.map((s: { id: number; name: string }) => ({
        suppId: s.id,
        suppName: s.name
      }))
    });
  } catch (err) {
    console.error("Error fetching reference options:", err);
    res.status(500).json({ message: "Failed to load reference options" });
  }
});


/*
LIST ROUTES
*/
// ✅ GET all items
router.get("/", verifyToken, requirePermission("INVENTORY_VIEW"), async (req, res) => {
  const data = await getAllInventoryItems();
  res.json(data);
});

// ✅ POST create item
router.post("/", verifyToken, requirePermission("INVENTORY_CREATE"), async (req, res) => {
  const newId = await createInventoryItem(req.body);
  res.status(201).json({ inventoryId: newId });
});

router.get('/item-options', async (req, res) => {
  try {
    const data = await getInventoryItemOptions();
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch inventory items:', err);
    res.status(500).json({ error: 'Failed to load inventory options' });
  }
});


/*
SUB-RESOURCE ROUTES
*/
// ✅ GET stock transactions
router.get("/:id/transactions", verifyToken, requirePermission("INVENTORY_VIEW"), async (req, res) => {
  const id = parseInt(req.params.id);
  const transactions = await getInventoryTransactions(id);
  res.json(transactions);
});

// ✅ POST stock transaction
router.post("/:id/transactions", verifyToken, requirePermission("INVENTORY_TRANSACTION_CREATE"), async (req, res) => {
  await addInventoryTransaction({
    inventoryId: parseInt(req.params.id),
    ...req.body
  });
  res.status(201).send();
});

// ✅ GET maintenance logs
router.get("/:id/maintenance", verifyToken, requirePermission("INVENTORY_MAINTENANCE_VIEW"), async (req, res) => {
  const id = parseInt(req.params.id);
  const data = await getInventoryMaintenanceLogs(id);
  res.json(data);
});

// ✅ POST maintenance log
router.post("/:id/maintenance", verifyToken, requirePermission("INVENTORY_MAINTENANCE_CREATE"), async (req, res) => {
  await addInventoryMaintenanceLog({
    inventoryId: parseInt(req.params.id),
    ...req.body
  });
  res.status(201).send();
});

// ✅ GET audit logs
router.get("/:id/audit", verifyToken, requirePermission("INVENTORY_VIEW"), async (req, res) => {
  const id = parseInt(req.params.id);
  const data = await getInventoryAuditLogs(id);
  res.json(data);
});

// check if item can be deleted
router.get("/:id/can-delete", asyncHandler(async (req, res) => {
  const inventoryId = parseInt(req.params.id);

  const [transactions, maintenance, audit] = await Promise.all([
    getInventoryTransactions(inventoryId),
    getInventoryMaintenanceLogs(inventoryId),
    getInventoryAuditLogs(inventoryId)
  ]);

  const canDelete = 
    (transactions.length === 0) &&
    (maintenance.length === 0) &&
    (audit.length === 0);

  res.json({ canDelete });
}));


/*
GENERAL ROUTES
*/
// ✅ GET single item
router.get("/:id", verifyToken, requirePermission("INVENTORY_VIEW"), asyncHandler(async (req, res) => {
    const itemId = parseInt(req.params.id);
    const item = await getInventoryItemById(itemId);   // your existing DB call
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
}));

// ✅ PUT update item
router.put("/:id", verifyToken, requirePermission("INVENTORY_EDIT"), asyncHandler(async (req, res) => {
  const inventoryId = parseInt(req.params.id);
  const data = req.body;

  if (isNaN(inventoryId)) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }

  await updateInventoryItem(inventoryId, data);
  res.status(200).json({ message: "Inventory item updated successfully" });
}));

// ✅ DELETE soft-delete item
router.delete("/:id", verifyToken, requirePermission("INVENTORY_DELETE"), async (req, res) => {
  const id = parseInt(req.params.id);
  await softDeleteInventoryItem(id);
  res.status(204).send();
});

export default router;

// src/backend/routes/inventoryRoutes.ts
import express from "express";
import {
  getInventoryList,
  getInventoryListPaged,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  softDeleteInventoryItem,
} from "../database/inventoryQueries";

import {
  getInventoryTransactions,
  addInventoryTransaction,
  getAllInventoryMaintenanceLogs,
  getAllInventoryAuditLogs,
  getInventoryTransactionsPaged,
  getInventoryTransactionsForCsv,
  type InventoryTransactionFilters,
} from "../database/inventoryTransactionQueries";

import {
  getInventoryMaintenanceLogs,
  addInventoryMaintenanceLog
} from "../database/inventoryMaintenanceQueries";

import {
  getAllInventoryItemsHandler
} from "../controllers/inventoryController";

import {
  getInventoryAuditLogs
} from "../database/inventoryAuditQueries";

import { PERMISSIONS } from "@/constants/permissions";
import { verifyToken, requirePermission } from "../middleware/authMiddleware";
import { mustGetAccountId } from "@/backend/utils/authGuards";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import { asyncHandler } from "@/backend/utils/asyncHandler";
import { getInventoryItemOptions } from '../database/ReferenceQueries';
import { z } from "zod";
import type { InventoryTransactionDTO } from "@/domain/inventory/inventoryTypes";
import { parseIntParam } from "../utils/requestParam";

const router = express.Router();

/*
FIXED ROUTES
*/
// This endpoint is used to fetch reference data for dropdowns and other UI elements
router.get("/reference-options", verifyToken, async (req, res, next) => {
  const accountId = mustGetAccountId(req, next);
  if (accountId == null) return;
  try {
    const data = await fetchReferenceOptions(accountId);
    res.json({
      categories: data.categories.map((c: { id: number; name: string }) => ({
        categoryId: c.id,
        CategoryName: c.name,
      })),
      manufacturers: data.manufacturers.map((m: { id: number; name: string }) => ({
        manuId: m.id,
        manuName: m.name,
      })),
      suppliers: data.suppliers.map((s: { id: number; name: string }) => ({
        suppId: s.id,
        suppName: s.name,
      })),
      warehouses: data.warehouses.map((w: { id: number; name: string }) => ({
        warehouseId: w.id,
        warehouseName: w.name,
      })),
    });
  } catch (err) {
    console.error("Error fetching reference options:", err);
    res.status(500).json({ message: "Failed to load reference options" });
  }
});

const inventoryListQuerySchema = z.object({
  page: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === "") return 1;
        const num = Number(val);
        return Number.isFinite(num) && num >= 1 ? num : 1;
      },
      z.number().int().min(1)
    )
    .default(1),
  pageSize: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === "") return 20;
        const num = Number(val);
        return Number.isFinite(num) && num >= 1 && num <= 100 ? num : 20;
      },
      z.number().int().min(1).max(100)
    )
    .default(20),
  search: z
    .preprocess(
      (val) =>
        val === undefined || val === null || val === "" ? undefined : String(val).trim(),
      z.string().max(200).optional()
    )
    .optional(),
  warehouseId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = Number(val);
        return Number.isFinite(num) && num > 0 ? num : undefined;
      },
      z.number().int().positive().optional()
    )
    .optional(),
  categoryId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = Number(val);
        return Number.isFinite(num) && num > 0 ? num : undefined;
      },
      z.number().int().positive().optional()
    )
    .optional(),
  suppId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = Number(val);
        return Number.isFinite(num) && num > 0 ? num : undefined;
      },
      z.number().int().positive().optional()
    )
    .optional(),
  manuId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === "") return undefined;
        const num = Number(val);
        return Number.isFinite(num) && num > 0 ? num : undefined;
      },
      z.number().int().positive().optional()
    )
    .optional(),
});

/*
LIST ROUTES
*/
// GET all items (array when no pagination params; envelope when page or pageSize present)
router.get("/", verifyToken, requirePermission(PERMISSIONS.INVENTORY_VIEW), async (req, res) => {
  const hasPagination =
    req.query.page !== undefined || req.query.pageSize !== undefined;
  if (!hasPagination) {
    const data = await getInventoryList();
    return res.json(data);
  }
  const parsed = inventoryListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid query parameters", errors: parsed.error.errors });
  }
  const { page, pageSize, search, warehouseId, categoryId, suppId, manuId } =
    parsed.data;
  const result = await getInventoryListPaged(
    { search, warehouseId, categoryId, suppId, manuId },
    page,
    pageSize
  );
  return res.json({
    page,
    pageSize,
    total: result.total,
    rows: result.rows,
  });
});

// ✅ POST create item
router.post("/", verifyToken, requirePermission(PERMISSIONS.INVENTORY_CREATE), async (req, res) => {
  const newId = await createInventoryItem(req.body);
  res.status(201).json({ inventoryId: newId });
});

router.get('/item-options', verifyToken, async (req, res, next) => {
  const accountId = mustGetAccountId(req, next);
  if (accountId == null) return;
  try {
    const data = await getInventoryItemOptions(accountId);
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch inventory items:', err);
    res.status(500).json({ error: 'Failed to load inventory options' });
  }
});

/*
ALL-SCOPE ROUTES (must be before /:id so "all" is not captured as id)
*/
// ✅ GET all inventory items (for dropdowns or selection)
router.get("/all", verifyToken, getAllInventoryItemsHandler);

// Query schema for transactions list
const transactionsQuerySchema = z.object({
  page: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return 1;
        const num = Number(val);
        return Number.isFinite(num) && num >= 1 ? num : 1;
      },
      z.number().int().min(1)
    )
    .default(1),
  pageSize: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return 20;
        const num = Number(val);
        return Number.isFinite(num) && num >= 1 && num <= 100 ? num : 20;
      },
      z.number().int().min(1).max(100)
    )
    .default(20),
  warehouseId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined;
        const num = Number(val);
        return Number.isFinite(num) && num > 0 ? num : undefined;
      },
      z.number().int().positive().optional()
    )
    .optional(),
  itemId: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined;
        const num = Number(val);
        return Number.isFinite(num) && num > 0 ? num : undefined;
      },
      z.number().int().positive().optional()
    )
    .optional(),
  transactionType: z
    .enum(["Receive", "Issue", "Adjustment"])
    .optional(),
  dateFrom: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined;
        if (typeof val === 'string') {
          const date = new Date(val);
          return Number.isNaN(date.getTime()) ? undefined : date;
        }
        return undefined;
      },
      z.date().optional()
    )
    .optional(),
  dateTo: z
    .preprocess(
      (val) => {
        if (val === undefined || val === null || val === '') return undefined;
        if (typeof val === 'string') {
          const date = new Date(val);
          if (Number.isNaN(date.getTime())) return undefined;
          return date;
        }
        return undefined;
      },
      z.date().optional()
    )
    .optional(),
});

// Get all stock transactions (paginated with filters)
router.get("/all/transactions", verifyToken, requirePermission(PERMISSIONS.INVENTORY_VIEW), asyncHandler(async (req, res) => {
  const parsed = transactionsQuerySchema.safeParse(req.query);
  
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters", errors: parsed.error.errors });
  }

  const { page, pageSize, warehouseId, itemId, transactionType, dateFrom, dateTo } = parsed.data;

  const filters: InventoryTransactionFilters = {
    warehouseId,
    itemId,
    transactionType,
    dateFrom,
    dateTo,
  };

  const result = await getInventoryTransactionsPaged(filters, page, pageSize);
  
  const response: { page: number; pageSize: number; total: number; rows: InventoryTransactionDTO[] } = {
    page,
    pageSize,
    total: result.total,
    rows: result.rows,
  };

  res.json(response);
}));

// Get all stock transactions as CSV
router.get("/all/transactions.csv", verifyToken, requirePermission(PERMISSIONS.INVENTORY_VIEW), asyncHandler(async (req, res) => {
  const parsed = transactionsQuerySchema.omit({ page: true, pageSize: true }).safeParse(req.query);
  
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid query parameters", errors: parsed.error.errors });
  }

  const { warehouseId, itemId, transactionType, dateFrom, dateTo } = parsed.data;

  const filters: InventoryTransactionFilters = {
    warehouseId,
    itemId,
    transactionType,
    dateFrom,
    dateTo,
  };

  // Check count first to enforce limit before fetching
  const countResult = await getInventoryTransactionsPaged(filters, 1, 1);
  if (countResult.total > 10000) {
    return res.status(413).json({ 
      message: "CSV export limit exceeded. Maximum 10,000 rows allowed. Please apply additional filters to reduce the result set." 
    });
  }

  const rows = await getInventoryTransactionsForCsv(filters, 10000);

  // Generate CSV
  const headers = [
    "Transaction ID",
    "Item ID",
    "Item Name",
    "Warehouse ID",
    "Warehouse Name",
    "Quantity Changed",
    "Transaction Type",
    "Performed At",
    "Performed By"
  ];

  // CSV escaping function
  const escapeCsvField = (field: unknown): string => {
    if (field === null || field === undefined) return "";
    const str = String(field);
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvRows = [
    headers.join(","),
    ...rows.map(row => [
      escapeCsvField(row.transactionId),
      escapeCsvField(row.itemId),
      escapeCsvField(row.itemName),
      escapeCsvField(row.warehouseId),
      escapeCsvField(row.warehouseName),
      escapeCsvField(row.quantityChanged),
      escapeCsvField(row.transactionType),
      escapeCsvField(row.performedAt),
      escapeCsvField(row.performedBy),
    ].join(","))
  ];

  const csv = csvRows.join("\n");

  // Generate filename with date range if present (sanitize for filesystem safety)
  let filename = "inventory-transactions";
  if (dateFrom || dateTo) {
    const fromStr = dateFrom ? dateFrom.toISOString().split("T")[0] : "all";
    const toStr = dateTo ? dateTo.toISOString().split("T")[0] : "all";
    // ISO dates are safe, but ensure no path separators or other unsafe chars
    const safeFrom = fromStr.replace(/[^0-9-]/g, "");
    const safeTo = toStr.replace(/[^0-9-]/g, "");
    filename += `-${safeFrom}-to-${safeTo}`;
  }
  filename += `.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}));

// Get all maintenance logs
router.get("/all/maintenance", verifyToken, requirePermission(PERMISSIONS.INVENTORY_MAINTENANCE_VIEW), asyncHandler(async (req, res) => {
  const data = await getAllInventoryMaintenanceLogs();
  res.json(data);
}));

// Get all audit logs
router.get("/all/audit", verifyToken, requirePermission(PERMISSIONS.INVENTORY_VIEW), asyncHandler(async (req, res) => {
  const data = await getAllInventoryAuditLogs();
  res.json(data);
}));

/*
SUB-RESOURCE ROUTES
*/
// ✅ GET stock transactions
router.get("/:id/transactions", verifyToken, requirePermission(PERMISSIONS.INVENTORY_VIEW), async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }
  const transactions = await getInventoryTransactions(id);
  res.json(transactions);
});

// ✅ POST stock transaction
router.post("/:id/transactions", verifyToken, requirePermission(PERMISSIONS.INVENTORY_TRANSACTION_CREATE), async (req, res) => {
  const inventoryId = parseIntParam(req.params.id);
  if (inventoryId == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }
  await addInventoryTransaction({
    inventoryId,
    ...req.body
  });
  res.status(201).send();
});

// ✅ GET maintenance logs
router.get("/:id/maintenance", verifyToken, requirePermission(PERMISSIONS.INVENTORY_MAINTENANCE_VIEW), async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }
  const data = await getInventoryMaintenanceLogs(id);
  res.json(data);
});

// ✅ POST maintenance log
router.post("/:id/maintenance", verifyToken, requirePermission(PERMISSIONS.INVENTORY_MAINTENANCE_CREATE), async (req, res) => {
  const inventoryId = parseIntParam(req.params.id);
  if (inventoryId == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }
  await addInventoryMaintenanceLog({
    inventoryId,
    ...req.body
  });
  res.status(201).send();
});

// ✅ GET audit logs
router.get("/:id/audit", verifyToken, requirePermission(PERMISSIONS.INVENTORY_VIEW), async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }
  const data = await getInventoryAuditLogs(id);
  res.json(data);
});

// check if item can be deleted
router.get("/:id/can-delete", asyncHandler(async (req, res) => {
  const inventoryId = parseIntParam(req.params.id);
  if (inventoryId == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }

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

// ✅ GET single item
router.get("/:id", verifyToken, requirePermission(PERMISSIONS.INVENTORY_VIEW), asyncHandler(async (req, res) => {
    const itemId = parseIntParam(req.params.id);
    if (itemId == null) {
      return res.status(400).json({ message: "Invalid inventory ID" });
    }
    const item = await getInventoryItemById(itemId);   // your existing DB call
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
}));

// ✅ PUT update item
router.put("/:id", verifyToken, requirePermission(PERMISSIONS.INVENTORY_EDIT), asyncHandler(async (req, res) => {
  const inventoryId = parseIntParam(req.params.id);
  const data = req.body;

  if (inventoryId == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }

  await updateInventoryItem(inventoryId, data);
  res.status(200).json({ message: "Inventory item updated successfully" });
}));

// ✅ DELETE soft-delete item
router.delete("/:id", verifyToken, requirePermission(PERMISSIONS.INVENTORY_DELETE), async (req, res) => {
  const id = parseIntParam(req.params.id);
  if (id == null) {
    return res.status(400).json({ message: "Invalid inventory ID" });
  }
  await softDeleteInventoryItem(id);
  res.status(204).send();
});

export default router;

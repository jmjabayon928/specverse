// src/validation/inventorySchema.ts

import { z } from "zod";

// Inventory Item Schema
export const inventoryItemSchema = z.object({
  itemCode: z.string().min(1, "Item Code is required").max(100),
  itemName: z.string().min(1, "Item Name is required").max(255),
  description: z.string().max(1000).optional().or(z.literal("")),
  categoryId: z.number().int().positive().optional().nullable(),
  supplierId: z.number().int().positive().optional().nullable(),
  manufacturerId: z.number().int().positive().optional().nullable(),
  location: z.string().max(255).optional().or(z.literal("")),
  reorderLevel: z
    .number({ invalid_type_error: "Reorder Level must be a number" })
    .min(0, "Reorder Level cannot be negative"),
  uom: z.string().max(50).optional().or(z.literal("")),
});

// Transaction Schema (Receive / Issue / Adjustment)
export const inventoryTransactionSchema = z.object({
  inventoryId: z.number().int().positive(),
  transactionType: z.enum(["Receive", "Issue", "Adjustment"]),
  quantityChanged: z
    .number({ invalid_type_error: "Quantity must be a number" })
    .gt(0, "Quantity must be greater than zero"),
  uom: z.string().max(50).optional().or(z.literal("")),
  referenceNote: z.string().max(500).optional().or(z.literal("")),
});

// Maintenance Log Schema
export const inventoryMaintenanceSchema = z.object({
  inventoryId: z.number().int().positive(),
  maintenanceDate: z.date(),
  description: z.string().min(1, "Description is required").max(1000),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

// ✅ Type Inference
export type InventoryFormValues = z.infer<typeof inventoryItemSchema>;
export type InventoryTransactionValues = z.infer<typeof inventoryTransactionSchema>;
export type InventoryMaintenanceValues = z.infer<typeof inventoryMaintenanceSchema>;

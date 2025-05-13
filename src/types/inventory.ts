import { z } from "zod";
import {
  inventoryItemSchema,
  inventoryTransactionSchema,
  inventoryMaintenanceSchema,
} from "@/validation/inventorySchema";

export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export type InventoryTransaction = z.infer<typeof inventoryTransactionSchema>;

export type InventoryMaintenanceLog = z.infer<typeof inventoryMaintenanceSchema>;

// Optional: Additional type for Inventory Item returned from DB
export interface InventoryItemDB extends InventoryItem {
  inventoryId: number;
  quantityOnHand: number;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Optional: Type for translations
export interface InventoryItemTranslation {
  inventoryItemTranslationId: number;
  inventoryId: number;
  languageCode: string;
  itemNameTranslation: string;
  descriptionTranslation?: string;
}

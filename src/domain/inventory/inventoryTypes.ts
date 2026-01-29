// src/domain/inventory/inventoryTypes.ts

// Base inventory item record
export interface InventoryItem {
  InventoryID: number
  ItemName: string
  Description?: string
  Specification?: string
  CategoryID: number
  CategoryName?: string
  UnitCost: number
  Quantity: number
  Unit?: string
  WarehouseID: number
  WarehouseName?: string
  MinStock?: number
  MaxStock?: number
  Status?: string
  CreatedAt: string
  UpdatedAt?: string
}

// DTO for inserting a new inventory item
export interface NewInventoryItemInput {
  ItemName: string
  Description?: string
  Specification?: string
  CategoryID: number
  UnitCost: number
  Quantity: number
  Unit?: string
  WarehouseID: number
  MinStock?: number
  MaxStock?: number
  CreatedBy?: number
}

// DTO for updating inventory item
export interface UpdateInventoryItemInput {
  ItemName?: string
  Description?: string
  Specification?: string
  CategoryID?: number
  UnitCost?: number
  Quantity?: number
  Unit?: string
  WarehouseID?: number
  MinStock?: number
  MaxStock?: number
  UpdatedBy?: number
}

// Canonical DTO for inventory items returned from DB queries (camelCase).
export interface InventoryItemDB {
  inventoryId: number
  itemCode: string
  itemName: string
  description?: string | null
  categoryId?: number | null
  supplierId?: number | null
  manufacturerId?: number | null
  location?: string | null
  reorderLevel: number
  uom?: string | null
  quantityOnHand: number
}

// DTO used when creating/updating inventory items via services/queries (camelCase).
export interface InventoryItemWrite {
  itemCode: string
  itemName: string
  description?: string | null
  categoryId?: number | null
  supplierId?: number | null
  manufacturerId?: number | null
  location?: string | null
  reorderLevel: number
  uom?: string | null
}

// Lightweight list row used for inventory overview tables.
export interface InventoryListItem {
  inventoryId: number
  sheetName: string
  quantity: number
  warehouseName: string
  lastUpdated: string
}


// Records each stock movement
export interface InventoryTransaction {
  TransactionID: number
  InventoryID: number
  ChangeQty: number
  Type: 'IN' | 'OUT'
  Reference?: string
  Notes?: string
  CreatedBy?: number
  CreatedAt: string
}

// Input for creating a new transaction
export interface NewInventoryTransactionInput {
  InventoryID: number
  ChangeQty: number
  Type: 'IN' | 'OUT'
  Reference?: string
  Notes?: string
  CreatedBy?: number
}

// DTO for inventory transactions (camelCase)
export interface InventoryTransactionDTO {
  transactionId: number
  itemId: number
  itemName: string
  warehouseId: number
  warehouseName: string
  quantityChanged: number
  transactionType: string
  performedAt: string
  performedBy: string | null
}

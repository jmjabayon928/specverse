"use client";

import React from "react";
import type { InventoryItemDB } from "@/types/inventory";

interface Props {
  item: InventoryItemDB;
}

export default function InventoryHeader({ item }: Props) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          {item.itemCode} - {item.itemName}
        </h1>
        <p className="text-sm text-gray-500">Inventory ID: {item.inventoryId}</p>
      </div>
      <div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${
            item.quantityOnHand < item.reorderLevel
              ? "bg-red-100 text-red-800"
              : "bg-green-100 text-green-800"
          }`}
        >
          {item.quantityOnHand < item.reorderLevel ? "Low Stock" : "Stock OK"}
        </span>
      </div>
    </div>
  );
}

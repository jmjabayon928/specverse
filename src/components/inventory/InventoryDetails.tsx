// src/components/inventory/InventoryDetails.tsx
"use client";

import React from "react";
import type { InventoryItemDB } from "@/types/inventory";

interface Props {
  item: InventoryItemDB;
  categories: { id: number; name: string }[];
  suppliers: { id: number; name: string }[];
  manufacturers: { id: number; name: string }[];
}

export default function InventoryDetails({
  item,
  categories,
  suppliers,
  manufacturers,
}: Props) {
  const categoryName = categories.find(c => c.id === item.categoryId)?.name ?? "-";
  const supplierName = suppliers.find(s => s.id === item.supplierId)?.name ?? "-";
  const manufacturerName = manufacturers.find(m => m.id === item.manufacturerId)?.name ?? "-";

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="font-medium text-gray-700">Item Code:</p>
        <p>{item.itemCode}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Item Name:</p>
        <p>{item.itemName}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Description:</p>
        <p>{item.description ?? "-"}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Location:</p>
        <p>{item.location ?? "-"}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Quantity On Hand:</p>
        <p>{item.quantityOnHand}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Reorder Level:</p>
        <p>{item.reorderLevel}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">UOM:</p>
        <p>{item.uom ?? "-"}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Category:</p>
        <p>{categoryName}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Supplier:</p>
        <p>{supplierName}</p>
      </div>
      <div>
        <p className="font-medium text-gray-700">Manufacturer:</p>
        <p>{manufacturerName}</p>
      </div>
    </div>
  );
}

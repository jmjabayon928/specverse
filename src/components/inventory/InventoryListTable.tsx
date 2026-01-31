// src/components/inventory/InventoryListTable.tsx
"use client";

import React from "react";
import type { InventoryListItem } from "@/domain/inventory/inventoryTypes";

interface Props {
  inventory: InventoryListItem[];
  onSelectItem: (id: number) => void;
}

export default function InventoryListTable({ inventory, onSelectItem }: Props) {
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="min-w-full text-sm border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2 text-left">Item</th>
            <th className="border px-4 py-2 text-left">Quantity</th>
            <th className="border px-4 py-2 text-left">Warehouse</th>
            <th className="border px-4 py-2 text-left">Category</th>
            <th className="border px-4 py-2 text-left">Supplier</th>
            <th className="border px-4 py-2 text-left">Manufacturer</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item, index) => (
            <tr
              key={item.inventoryId ?? `fallback-${index}`}
              className="cursor-pointer hover:bg-gray-50 transition"
              onClick={() => onSelectItem(item.inventoryId)}
            >
              <td className="border px-4 py-2">{item.sheetName}</td>
              <td className="border px-4 py-2">{item.quantity}</td>
              <td className="border px-4 py-2">{item.warehouseName}</td>
              <td className="border px-4 py-2">{item.categoryName ?? "—"}</td>
              <td className="border px-4 py-2">{item.supplierName ?? "—"}</td>
              <td className="border px-4 py-2">{item.manufacturerName ?? "—"}</td>
            </tr>
          ))}
          {inventory.length === 0 && (
            <tr>
              <td colSpan={6} className="border px-4 py-2 text-center text-gray-500">
                No inventory items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// src/components/inventory/InventoryListTable.tsx
"use client";

import React from "react";
import type { InventoryListItem } from "@/types/inventory";

interface Props {
  inventory: InventoryListItem[];
  onSelectItem: (id: number) => void;
}

export default function InventoryListTable({ inventory, onSelectItem }: Props) {
  console.log("Inventory list being rendered:", inventory);
  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="min-w-full text-sm border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2 text-left">Item</th>
            <th className="border px-4 py-2 text-left">Quantity</th>
            <th className="border px-4 py-2 text-left">Warehouse</th>
          </tr>
        </thead>
        <tbody>
          {inventory.map((item, index) => (
            <tr
              key={item.inventoryId ?? `fallback-${index}`}
              className="cursor-pointer hover:bg-gray-50 transition"
              onClick={() => onSelectItem(item.inventoryId)}
            >
              <td className="border px-4 py-2">{item.SheetName}</td>
              <td className="border px-4 py-2">{item.Quantity}</td>
              <td className="border px-4 py-2">{item.WarehouseName}</td>
            </tr>
          ))}
          {inventory.length === 0 && (
            <tr>
              <td colSpan={3} className="border px-4 py-2 text-center text-gray-500">
                No inventory items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

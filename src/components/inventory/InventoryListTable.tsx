"use client";

import React from "react";
import type { InventoryItemDB } from "@/types/inventory";
import { useRouter } from "next/navigation";
import { checkUserPermission } from "@/utils/permissionUtils";

interface Props {
  items: InventoryItemDB[];
}

export default function InventoryListTable({ items }: Props) {
  const router = useRouter();
  const canEdit = checkUserPermission("INVENTORY_EDIT");
  const canDelete = checkUserPermission("INVENTORY_DELETE");

  return (
    <div className="overflow-x-auto border rounded-md bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-100 text-xs uppercase text-gray-600">
          <tr>
            <th className="px-4 py-3 text-left">Item Code</th>
            <th className="px-4 py-3 text-left">Item Name</th>
            <th className="px-4 py-3 text-right">Quantity</th>
            <th className="px-4 py-3 text-right">Reorder Level</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item, index) => {
            const lowStock = item.quantityOnHand < item.reorderLevel;
            return (
              <tr key={item.inventoryId ?? `${item.itemName}-${index}`}>
                <td className="px-4 py-2">{item.itemCode}</td>
                <td className="px-4 py-2">{item.itemName}</td>
                <td className="px-4 py-2 text-right">{item.quantityOnHand}</td>
                <td className="px-4 py-2 text-right">{item.reorderLevel}</td>
                <td className="px-4 py-2">{item.location}</td>
                <td className="px-4 py-2">
                  {lowStock ? (
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                      Low Stock
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                      OK
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-center space-x-1">
                  <button
                    onClick={() => router.push(`/inventory/${item.inventoryId}`)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    View
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => router.push(`/inventory/${item.inventoryId}/edit`)}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-yellow-600 hover:text-yellow-800"
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      onClick={() => console.warn("TODO: Handle delete")}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-4 text-center text-gray-500">
                No inventory items found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

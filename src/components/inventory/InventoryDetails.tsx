"use client";

import React, { useEffect, useState } from "react";
import type { InventoryItemDB } from "@/types/inventory";

interface Props {
  inventoryId: number;
  categories: { id: number; name: string }[];
  suppliers: { id: number; name: string }[];
  manufacturers: { id: number; name: string }[];
}

export default function InventoryDetails({
  inventoryId,
  categories,
  suppliers,
  manufacturers,
}: Props) {
  const [item, setItem] = useState<InventoryItemDB | null>(null);

  useEffect(() => {
    async function fetchItem() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}`);
        if (!res.ok) throw new Error("Failed to load item");
        const data = await res.json();
        setItem(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchItem();
  }, [inventoryId]);

  if (!item) return <div>Loading...</div>;

  const categoryName = categories.find(c => c.id === item.categoryId)?.name ?? "-";
  const supplierName = suppliers.find(s => s.id === item.supplierId)?.name ?? "-";
  const manufacturerName = manufacturers.find(m => m.id === item.manufacturerId)?.name ?? "-";

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div><p className="font-medium text-gray-700">Item Code:</p><p>{item.itemCode}</p></div>
      <div><p className="font-medium text-gray-700">Item Name:</p><p>{item.itemName}</p></div>
      <div><p className="font-medium text-gray-700">Description:</p><p>{item.description ?? "-"}</p></div>
      <div><p className="font-medium text-gray-700">Location:</p><p>{item.location ?? "-"}</p></div>
      <div><p className="font-medium text-gray-700">Quantity On Hand:</p><p>{item.quantityOnHand}</p></div>
      <div><p className="font-medium text-gray-700">Reorder Level:</p><p>{item.reorderLevel}</p></div>
      <div><p className="font-medium text-gray-700">UOM:</p><p>{item.uom ?? "-"}</p></div>
      <div><p className="font-medium text-gray-700">Category:</p><p>{categoryName}</p></div>
      <div><p className="font-medium text-gray-700">Supplier:</p><p>{supplierName}</p></div>
      <div><p className="font-medium text-gray-700">Manufacturer:</p><p>{manufacturerName}</p></div>
    </div>
  );
}

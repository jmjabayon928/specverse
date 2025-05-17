import React from "react";
import Link from "next/link";
import { checkUserPermission } from "@/utils/permissionUtils";
import InventoryListTable from "@/components/inventory/InventoryListTable";
import InventoryFilters from "@/components/inventory/InventoryFilters";

// Optional: fetch from API service
async function getInventoryItems() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory`, {
    cache: "no-store"
  });
  if (!res.ok) throw new Error("Failed to fetch inventory items");
  return res.json();
}

export default async function InventoryDashboardPage() {
  const items = await getInventoryItems();
  const canCreate = checkUserPermission("INVENTORY_CREATE");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-800">Inventory Management</h1>
        {canCreate && (
          <Link
            href="/inventory/create"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Create Item
          </Link>
        )}
      </div>

      {/* Filters section */}
      <InventoryFilters />

      {/* Inventory table */}
      <InventoryListTable items={items} />
    </div>
  );
}

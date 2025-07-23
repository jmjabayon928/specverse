"use client";

import { useState } from "react";
import type { InventoryListItem } from "@/types/inventory";
import InventoryListTable from "./InventoryListTable";
import InventoryTabContent from "./InventoryTabContent";

interface Props {
  inventory: InventoryListItem[];
  canEditStock: boolean;
  canEditMaintenance: boolean;
}

export default function InventoryPageClient({ 
    inventory, 
    canEditStock,
    canEditMaintenance
}: Props) {
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null);
  const [activeTab] = useState("transactions"); // no tab switching yet

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Inventory</h1>

      <InventoryListTable
        inventory={inventory}
        onSelectItem={(id) => setSelectedInventoryId(id)}
      />

      {selectedInventoryId && (
        <div className="mt-8">
          <InventoryTabContent
            inventoryId={selectedInventoryId}
            activeTab={activeTab}
            canEditStock={canEditStock}
            canEditMaintenance={canEditMaintenance}
          />
        </div>
      )}
    </div>
  );
}

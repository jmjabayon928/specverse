// src/components/inventory/InventoryPageClient.tsx
"use client";

import { useState } from "react";
import type { InventoryListItem } from "@/types/inventory";
import InventoryListTable from "./InventoryListTable";
import InventoryTabContent from "./InventoryTabContent";

interface Props {
  inventory: InventoryListItem[];
  canEditStock: boolean;
  canEditMaintenance: boolean;
  onSelectItem?: (id: number) => void; // ✅ Make this optional
}

export default function InventoryPageClient({
  inventory,
  canEditStock,
  canEditMaintenance,
  onSelectItem,
}: Props) {
  const [selectedInventoryId, setSelectedInventoryId] = useState<number | null>(null);
  const [activeTab] = useState("transactions"); // you can add tab switching later

  // ✅ Local handler: if no onSelectItem is provided, fallback to inline panel
  const handleSelectItem = (id: number) => {
    if (onSelectItem) {
      onSelectItem(id); 
    } else {
      setSelectedInventoryId(id); 
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Inventory</h1>

      <InventoryListTable
        inventory={inventory}
        onSelectItem={handleSelectItem} 
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


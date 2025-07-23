// src/components/inventory/InventoryTabContent.tsx
"use client";

import React, { Suspense } from "react";
import StockTransactionTable from "./StockTransactionTable";
import MaintenanceLogTable from "./MaintenanceLogTable";
import AuditLogTable from "./AuditLogTable";

interface Props {
  inventoryId: number;
  activeTab: string;
  canEditStock: boolean;
  canEditMaintenance: boolean;
}

export default function InventoryTabContent({
  inventoryId,
  activeTab,
  canEditStock,
  canEditMaintenance,
}: Props) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {activeTab === "transactions" && (
        <StockTransactionTable 
          inventoryId={inventoryId} 
            canEdit={canEditStock} 
        />
      )}
      {activeTab === "maintenance" && (
        <MaintenanceLogTable
          inventoryId={inventoryId}
          canEdit={canEditMaintenance}
        />
      )}
      {activeTab === "audit" && (
        <AuditLogTable inventoryId={inventoryId} />
      )}
    </Suspense>
  );
}

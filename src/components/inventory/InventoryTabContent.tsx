// src/components/inventory/InventoryTabContent.tsx
"use client";

import React, { Suspense } from "react";
import StockTransactionTable from "./StockTransactionTable";
import MaintenanceLogTable from "./MaintenanceLogTable";
import AuditLogTable from "./AuditLogTable";

interface Props {
  inventoryId: number;
  activeTab: string;
}

export default function InventoryTabContent({
  inventoryId,
  activeTab,
}: Props) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      {activeTab === "transactions" && (
        <StockTransactionTable inventoryId={inventoryId} />
      )}
      {activeTab === "maintenance" && (
        <MaintenanceLogTable inventoryId={inventoryId} />
      )}
      {activeTab === "audit" && (
        <AuditLogTable inventoryId={inventoryId} />
      )}
    </Suspense>
  );
}

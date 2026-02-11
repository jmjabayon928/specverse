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
  canViewTransactions: boolean;
  canViewMaintenance: boolean;
  canViewAudit: boolean;
}

export default function InventoryTabContent({
  inventoryId,
  activeTab,
  canEditStock,
  canEditMaintenance,
  canViewTransactions,
  canViewMaintenance,
  canViewAudit,
}: Props) {
  if (activeTab === "transactions") {
    if (!canViewTransactions) {
      return <p className="text-sm text-gray-500">No access</p>;
    }
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <StockTransactionTable inventoryId={inventoryId} canEdit={canEditStock} />
      </Suspense>
    );
  }
  if (activeTab === "maintenance") {
    if (!canViewMaintenance) {
      return <p className="text-sm text-gray-500">No access</p>;
    }
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <MaintenanceLogTable inventoryId={inventoryId} canEdit={canEditMaintenance} />
      </Suspense>
    );
  }
  if (activeTab === "audit") {
    if (!canViewAudit) {
      return <p className="text-sm text-gray-500">No access</p>;
    }
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <AuditLogTable inventoryId={inventoryId} />
      </Suspense>
    );
  }
  return null;
}

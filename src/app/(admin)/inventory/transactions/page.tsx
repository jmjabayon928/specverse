"use client";

import { Suspense } from "react";
import { useSession } from "@/hooks/useSession";
import { PERMISSIONS } from "@/constants/permissions";
import InventoryTransactionsClient from "./InventoryTransactionsClient";

export default function GlobalTransactionsPage() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">All Stock Transactions</h1>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">All Stock Transactions</h1>
        <p className="text-sm text-gray-500">No access</p>
      </div>
    );
  }

  const userRole = user.role?.toLowerCase() ?? '';
  const permissions = user.permissions ?? [];
  
  const hasPermission = (permission: string) => {
    if (!permission) return false;
    if (userRole === 'admin') return true;
    return permissions.includes(permission);
  };

  if (!hasPermission(PERMISSIONS.INVENTORY_VIEW)) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">All Stock Transactions</h1>
        <p className="text-sm text-gray-500">No access</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <InventoryTransactionsClient />
    </Suspense>
  );
}

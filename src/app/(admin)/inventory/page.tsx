'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import InventoryPageClient from '@/components/inventory/InventoryPageClient';
import SecurePage from '@/components/security/SecurePage';

export default function InventoryPage() {
  const { user, loading } = useSession();
  const [inventory, setInventory] = useState<Array<{
    InventoryID: number;
    SheetName: string;
    Quantity: number;
    WarehouseName: string;
  }>>([]);

  useEffect(() => {
    if (!loading && user) {
      fetch('/api/backend/inventory', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      })
        .then((res) => res.json())
        .then((data) => setInventory(data || []));
    }
  }, [loading, user]);

  const canEditStock = !!user?.permissions.includes('EDIT_STOCK_TRANSACTIONS');
  const canEditMaintenance = !!user?.permissions.includes('EDIT_MAINTENANCE_LOGS');

  return (
    <SecurePage requiredPermission="INVENTORY_VIEW">
      <InventoryPageClient
        inventory={inventory.map((item) => ({
          inventoryId: item.InventoryID,
          SheetName: item.SheetName,
          Quantity: item.Quantity,
          WarehouseName: item.WarehouseName,
        }))}
        canEditStock={canEditStock}
        canEditMaintenance={canEditMaintenance}
      />
    </SecurePage>
  );
}

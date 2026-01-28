// src/app/(admin)/inventory/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import InventoryPageClient from '@/components/inventory/InventoryPageClient';
import SecurePage from '@/components/security/SecurePage';
import type { InventoryListItem } from '@/domain/inventory/inventoryTypes';

export default function InventoryPage() {
  const { user, loading } = useSession();
  const router = useRouter();

  const [inventory, setInventory] = useState<InventoryListItem[]>([]);

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
        .then((data) => {
          if (!Array.isArray(data)) {
            setInventory([]);
            return;
          }

          const mapped: InventoryListItem[] = [];

          for (const item of data) {
            if (typeof item !== 'object' || item === null) {
              continue;
            }

            const raw = item as Record<string, unknown>;

            const inventoryId =
              typeof raw.inventoryId === 'number'
                ? raw.inventoryId
                : typeof raw.InventoryID === 'number'
                  ? raw.InventoryID
                  : 0;

            const sheetName =
              typeof raw.sheetName === 'string'
                ? raw.sheetName
                : typeof raw.SheetName === 'string'
                  ? raw.SheetName
                  : '';

            const quantity =
              typeof raw.quantity === 'number'
                ? raw.quantity
                : typeof raw.Quantity === 'number'
                  ? raw.Quantity
                  : 0;

            const warehouseName =
              typeof raw.warehouseName === 'string'
                ? raw.warehouseName
                : typeof raw.WarehouseName === 'string'
                  ? raw.WarehouseName
                  : '';

            let lastUpdated = '';
            if (raw.lastUpdated !== undefined) {
              if (typeof raw.lastUpdated === 'string') {
                lastUpdated = raw.lastUpdated;
              } else if (raw.lastUpdated instanceof Date) {
                lastUpdated = raw.lastUpdated.toISOString();
              } else {
                lastUpdated = String(raw.lastUpdated);
              }
            } else if (raw.LastUpdated !== undefined) {
              if (typeof raw.LastUpdated === 'string') {
                lastUpdated = raw.LastUpdated;
              } else if (raw.LastUpdated instanceof Date) {
                lastUpdated = raw.LastUpdated.toISOString();
              } else {
                lastUpdated = String(raw.LastUpdated);
              }
            }

            mapped.push({
              inventoryId,
              sheetName,
              quantity,
              warehouseName,
              lastUpdated,
            });
          }

          setInventory(mapped);
        });
    }
  }, [loading, user]);

  const canEditStock = !!user?.permissions.includes('EDIT_STOCK_TRANSACTIONS');
  const canEditMaintenance = !!user?.permissions.includes('EDIT_MAINTENANCE_LOGS');

  const handleSelectItem = (id: number) => {
    router.push(`/inventory/${id}`);
  };

  return (
    <SecurePage requiredPermission="INVENTORY_VIEW">
      <InventoryPageClient
        inventory={inventory}
        canEditStock={canEditStock}
        canEditMaintenance={canEditMaintenance}
        onSelectItem={handleSelectItem}
      />
    </SecurePage>
  );
}

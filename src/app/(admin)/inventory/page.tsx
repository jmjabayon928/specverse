// src/app/(admin)/inventory/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/hooks/useSession';
import { PERMISSIONS } from '@/constants/permissions';
import InventoryPageClient from '@/components/inventory/InventoryPageClient';
import SecurePage from '@/components/security/SecurePage';

export default function InventoryPage() {
  const { loading } = useSession();
  const router = useRouter();

  const handleSelectItem = (id: number) => {
    router.push(`/inventory/${id}`);
  };

  if (loading) {
    return (
      <SecurePage requiredPermission={PERMISSIONS.INVENTORY_VIEW}>
        <div className="p-6">Loading…</div>
      </SecurePage>
    );
  }

  return (
    <SecurePage requiredPermission={PERMISSIONS.INVENTORY_VIEW}>
      <InventoryPageClient onSelectItem={handleSelectItem} />
    </SecurePage>
  );
}

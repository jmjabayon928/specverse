import { notFound } from 'next/navigation';
import { apiJson } from '@/utils/apiJson.server';
import InventoryFormClient from '@/components/inventory/InventoryFormClient';
import { requireAuth } from '@/utils/sessionUtils.server';
import type { InventoryItemDB } from '@/domain/inventory/inventoryTypes';

interface InventoryEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function InventoryEditPage({ params }: Readonly<InventoryEditPageProps>) {
  const { id } = await params;
  const itemId = parseInt(id);
  if (isNaN(itemId)) return notFound();

  const session = await requireAuth();
  const accountId = session.accountId;
  if (accountId == null) return notFound();

  const itemUrl = `/api/backend/inventory/${itemId}`
  const refUrl = '/api/backend/inventory/reference-options'
  type RefData = { categories?: Array<{ categoryId: number; CategoryName: string }>; suppliers?: Array<{ suppId: number; suppName: string }>; manufacturers?: Array<{ manuId: number; manuName: string }> }
  const [item, refData] = await Promise.all([
    apiJson<InventoryItemDB>(itemUrl, { cache: 'no-store' }, {
      assert: (v): v is InventoryItemDB => typeof v === 'object' && v != null && typeof (v as { inventoryId?: unknown }).inventoryId === 'number' && (typeof (v as { itemName?: unknown }).itemName === 'string' || typeof (v as { itemCode?: unknown }).itemCode === 'string')
    }),
    apiJson<RefData>(refUrl, { cache: 'no-store' }),
  ]);

  const categories = refData.categories?.map((c: { categoryId: number; CategoryName: string }) => ({
    id: c.categoryId,
    name: c.CategoryName,
  })) ?? [];
  const suppliers = refData.suppliers?.map((s: { suppId: number; suppName: string }) => ({
    id: s.suppId,
    name: s.suppName,
  })) ?? [];
  const manufacturers = refData.manufacturers?.map((m: { manuId: number; manuName: string }) => ({
    id: m.manuId,
    name: m.manuName,
  })) ?? [];

  const initialValues = {
    itemCode: item.itemCode ?? '',
    itemName: item.itemName ?? '',
    description: item.description ?? undefined,
    categoryId: item.categoryId ?? null,
    supplierId: item.supplierId ?? null,
    manufacturerId: item.manufacturerId ?? null,
    location: item.location ?? undefined,
    reorderLevel: item.reorderLevel,
    uom: item.uom ?? undefined,
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Edit Inventory Item</h1>
      <InventoryFormClient
        initialValues={initialValues}
        mode="edit"
        categories={categories}
        suppliers={suppliers}
        manufacturers={manufacturers}
        inventoryId={item.inventoryId}
      />
    </div>
  );
}

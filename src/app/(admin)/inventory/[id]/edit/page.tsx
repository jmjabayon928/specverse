import { notFound } from 'next/navigation';
import { apiJson } from '@/utils/apiJson.server';
import InventoryFormClient from '@/components/inventory/InventoryFormClient';
import { requireAuth } from '@/utils/sessionUtils.server';

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

  const [item, referenceData] = await Promise.all([
    apiJson<{ inventoryId: number; itemCode: string; itemName: string; description: string | null; categoryId: number | null; supplierId: number | null; manufacturerId: number | null; location: string | null; reorderLevel: number; uom: string | null }>(
      `/api/backend/inventory/${itemId}`,
      { cache: 'no-store' }
    ).catch(() => null),
    apiJson<{ categories: Array<{ categoryId: number; CategoryName: string }>; suppliers: Array<{ suppId: number; suppName: string }>; manufacturers: Array<{ manuId: number; manuName: string }> }>(
      '/api/backend/inventory/reference-options',
      { cache: 'no-store' }
    ),
  ]);
  if (!item) return notFound();

  const categories = referenceData.categories.map(c => ({ id: c.categoryId, name: c.CategoryName }));
  const suppliers = referenceData.suppliers.map(s => ({ id: s.suppId, name: s.suppName }));
  const manufacturers = referenceData.manufacturers.map(m => ({ id: m.manuId, name: m.manuName }));

  const initialValues = {
    itemCode: item.itemCode,
    itemName: item.itemName,
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

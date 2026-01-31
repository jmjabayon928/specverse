import { notFound } from 'next/navigation';
import { getInventoryItemById } from '@/backend/database/inventoryQueries';
import { fetchReferenceOptions } from '@/backend/database/ReferenceQueries';
import InventoryFormClient from '@/components/inventory/InventoryFormClient';

interface InventoryEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function InventoryEditPage({ params }: Readonly<InventoryEditPageProps>) {
  const { id } = await params;
  const itemId = parseInt(id);
  if (isNaN(itemId)) return notFound();

  const item = await getInventoryItemById(itemId);
  if (!item) return notFound();

  const { categories, suppliers, manufacturers } = await fetchReferenceOptions();

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

import { notFound } from 'next/navigation';
import { getInventoryItemById } from '@/backend/database/inventoryQueries';
import { fetchReferenceOptions } from '@/backend/database/ReferenceQueries';
import InventoryFormClient from '@/components/inventory/InventoryFormClient';

interface InventoryEditPageProps {
  params: {
    id: string;
  };
}

export default async function InventoryEditPage({ params }: InventoryEditPageProps) {
  const itemId = parseInt(params.id);
  if (isNaN(itemId)) return notFound();

  const item = await getInventoryItemById(itemId);
  if (!item) return notFound();

  const { categories, suppliers, manufacturers } = await fetchReferenceOptions();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Edit Inventory Item</h1>
      <InventoryFormClient
        initialValues={item}
        mode="edit"
        categories={categories}
        suppliers={suppliers}
        manufacturers={manufacturers}
        inventoryId={item.inventoryId}
      />
    </div>
  );
}

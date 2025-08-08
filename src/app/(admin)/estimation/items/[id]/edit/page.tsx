// src/app/(admin)/estimation/items/[id]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ItemForm from '@/components/estimation/ItemForm';
import { EstimationItem } from '@/types/estimation';

export default function EditItemPage() {
  const { id } = useParams();
  const router = useRouter();
  const [item, setItem] = useState<EstimationItem | null>(null);

  useEffect(() => {
    const fetchItem = async () => {
      const res = await fetch(`/api/estimation/items/${id}`);
      const data = await res.json();
      setItem(data);
    };
    if (id) fetchItem();
  }, [id]);

  if (!item) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Edit Estimation Item</h1>
      <ItemForm
        mode="edit"
        defaultValues={{
          EItemID: item.EItemID,
          ItemID: item.ItemID,
          Description: item.Description ?? "", // ✅ fallback to empty string
          Quantity: item.Quantity,
        }}
        estimationId={item.EstimationID}
        packageId={item.PackageID ?? 0}
        items={[]} 
        inventoryItems={[]} 
        onSuccess={() => router.push(`/estimation/packages/${item.PackageID}`)}
        onCancel={() => router.back()}
      />
    </div>
  );
}

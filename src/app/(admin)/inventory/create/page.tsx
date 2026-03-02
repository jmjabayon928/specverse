// src/app/(admin)/inventory/create/page.tsx

import { notFound } from "next/navigation";
import { apiJson } from "@/utils/apiJson.server";
import InventoryFormClient from "@/components/inventory/InventoryFormClient";
import type { InventoryFormValues } from "@/validation/inventorySchema";
import { requireAuth } from "@/utils/sessionUtils.server";

export default async function CreateInventoryItemPage() {
  const session = await requireAuth();
  const accountId = session.accountId;
  if (accountId == null) return notFound();

  const referenceData = await apiJson<{ categories: Array<{ id: number; name: string }>; suppliers: Array<{ id: number; name: string }>; manufacturers: Array<{ id: number; name: string }> }>(
    '/api/backend/inventory/reference-options',
    { cache: 'no-store' }
  );

  const initialValues: InventoryFormValues = {
    itemCode: "",
    itemName: "",
    description: "",
    categoryId: null,
    supplierId: null,
    manufacturerId: null,
    location: "",
    reorderLevel: 0,
    uom: "",
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">Create New Inventory Item</h1>
      <InventoryFormClient
        initialValues={initialValues}
        mode="create"
        categories={referenceData.categories}
        suppliers={referenceData.suppliers}
        manufacturers={referenceData.manufacturers}
      />
    </div>
  );
}

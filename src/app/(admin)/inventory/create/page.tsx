// src/app/(admin)/inventory/create/page.tsx

import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import InventoryFormClient from "@/components/inventory/InventoryFormClient";
import type { InventoryFormValues } from "@/validation/inventorySchema";

export default async function CreateInventoryItemPage() {
  const referenceData = await fetchReferenceOptions();

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

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

  const refUrl = '/api/backend/inventory/reference-options'
  type RefData = { categories?: Array<{ categoryId: number; CategoryName: string }>; suppliers?: Array<{ suppId: number; suppName: string }>; manufacturers?: Array<{ manuId: number; manuName: string }> }
  const refData = await apiJson<RefData>(refUrl, { cache: 'no-store' });
  const referenceData = {
    categories: refData.categories?.map((c: { categoryId: number; CategoryName: string }) => ({
      id: c.categoryId,
      name: c.CategoryName,
    })) ?? [],
    suppliers: refData.suppliers?.map((s: { suppId: number; suppName: string }) => ({
      id: s.suppId,
      name: s.suppName,
    })) ?? [],
    manufacturers: refData.manufacturers?.map((m: { manuId: number; manuName: string }) => ({
      id: m.manuId,
      name: m.manuName,
    })) ?? [],
  };

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

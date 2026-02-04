// src/app/(admin)/inventory/[id]/page.tsx
import { notFound } from "next/navigation";
import { LayoutDashboard, FileText, Wrench, ClipboardList } from "lucide-react";
import { getInventoryItemById } from "@/backend/database/inventoryQueries";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import InventoryDetails from "@/components/inventory/InventoryDetails";
import InventoryTabLink from "@/components/inventory/InventoryTabLink";
import InventoryTabContent from "@/components/inventory/InventoryTabContent";
import { requireAuth } from "@/utils/sessionUtils.server";

interface InventoryPageProps {
  params: Promise<{ id?: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function InventoryDetailPage(
  { params, searchParams }: Readonly<InventoryPageProps>
) {
  const { id } = await params;
  const itemId = Number(id ?? "0");
  if (Number.isNaN(itemId)) return notFound();

  const session = await requireAuth();
  const accountId = session.accountId;
  if (accountId == null) return notFound();

  const item = await getInventoryItemById(itemId);
  if (!item) return notFound();

  const { categories, suppliers, manufacturers } = await fetchReferenceOptions(accountId);
  const resolvedSearchParams = await searchParams;
  const activeTab = resolvedSearchParams.tab ?? "overview";

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">
        Inventory Item: {item.itemName}
      </h1>

      <div className="bg-white border rounded-md">
        <div className="flex gap-6 border-b border-gray-200 mb-4">
          <InventoryTabLink
            href={`/inventory/${itemId}?tab=overview`}
            label="Overview"
            icon={<LayoutDashboard className="w-4 h-4" />}
          />
          <InventoryTabLink
            href={`/inventory/${itemId}?tab=transactions`}
            label="Transactions"
            icon={<FileText className="w-4 h-4" />}
          />
          <InventoryTabLink
            href={`/inventory/${itemId}?tab=maintenance`}
            label="Maintenance"
            icon={<Wrench className="w-4 h-4" />}
          />
          <InventoryTabLink
            href={`/inventory/${itemId}?tab=audit`}
            label="Audit Logs"
            icon={<ClipboardList className="w-4 h-4" />}
          />
        </div>

        <div className="p-4 bg-white rounded-md shadow-sm border">
          {activeTab === "overview" ? (
            <InventoryDetails
              item={item} // ✅ Add this line
              categories={categories}
              suppliers={suppliers}
              manufacturers={manufacturers}
            />
          ) : (
            <InventoryTabContent
              inventoryId={itemId}
              activeTab={activeTab}
              canEditStock={true}
              canEditMaintenance={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import { LayoutDashboard, FileText, Wrench, ClipboardList } from "lucide-react";
import { getInventoryItemById } from "@/backend/database/inventoryQueries";
import { getAllReferenceOptions } from "@/backend/database/ReferenceQueries";
import InventoryDetails from "@/components/inventory/InventoryDetails";
import InventoryTabLink from "@/components/inventory/InventoryTabLink";
import InventoryTabContent from "@/components/inventory/InventoryTabContent";

interface InventoryPageProps {
  params: { id: string };
  searchParams: { tab?: string };
}

export default async function InventoryDetailPage({
  params,
  searchParams,
}: InventoryPageProps) {
  const itemId = Number(params.id ?? "0");
  if (isNaN(itemId)) return notFound();

  const item = await getInventoryItemById(itemId);
  if (!item) return notFound();

  const { categories, suppliers, manufacturers } = await getAllReferenceOptions();
  const activeTab = searchParams?.tab ?? "overview";

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
          {activeTab === "overview" && (
            <InventoryDetails
              inventoryId={itemId}
              categories={categories}
              suppliers={suppliers}
              manufacturers={manufacturers}
            />
          )}
          {activeTab !== "overview" && (
            <InventoryTabContent inventoryId={itemId} activeTab={activeTab} />
          )}
        </div>
      </div>
    </div>
  );
}

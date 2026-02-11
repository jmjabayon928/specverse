// src/app/(admin)/inventory/[id]/page.tsx
import { notFound } from "next/navigation";
import { LayoutDashboard, FileText, Wrench, ClipboardList } from "lucide-react";
import { getInventoryItemById } from "@/backend/database/inventoryQueries";
import { fetchReferenceOptions } from "@/backend/database/ReferenceQueries";
import InventoryDetails from "@/components/inventory/InventoryDetails";
import InventoryTabLink from "@/components/inventory/InventoryTabLink";
import InventoryTabContent from "@/components/inventory/InventoryTabContent";
import { requireAuth } from "@/utils/sessionUtils.server";
import { PERMISSIONS } from "@/constants/permissions";

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
  const INVENTORY_TABS = ["overview", "transactions", "audit", "maintenance"] as const;
  type InventoryTab = (typeof INVENTORY_TABS)[number];
  const rawTabParam = resolvedSearchParams.tab ?? "overview";
  const rawTab: InventoryTab = INVENTORY_TABS.includes(rawTabParam as InventoryTab)
    ? (rawTabParam as InventoryTab)
    : "overview";
  const canEditStock = session.permissions?.includes(PERMISSIONS.INVENTORY_TRANSACTION_CREATE) ?? false;
  const canEditMaintenance = session.permissions?.includes(PERMISSIONS.INVENTORY_MAINTENANCE_CREATE) ?? false;

  const canViewInventory = session.permissions?.includes(PERMISSIONS.INVENTORY_VIEW) ?? false;
  const canViewMaintenance = session.permissions?.includes(PERMISSIONS.INVENTORY_MAINTENANCE_VIEW) ?? false;
  const canViewOverview = canViewInventory;
  const canViewTransactions = canViewInventory;
  const canViewAudit = canViewInventory;

  const tabAllowed: Record<string, boolean> = {
    overview: canViewOverview,
    transactions: canViewTransactions,
    maintenance: canViewMaintenance,
    audit: canViewAudit,
  };
  const firstAllowedTab: InventoryTab = INVENTORY_TABS.find(
    (t) => tabAllowed[t]
  ) ?? "overview";
  const activeTab: InventoryTab = tabAllowed[rawTab] ? rawTab : firstAllowedTab;

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
            disabled={!canViewOverview}
            activeTabOverride={activeTab}
          />
          <InventoryTabLink
            href={`/inventory/${itemId}?tab=transactions`}
            label="Transactions"
            icon={<FileText className="w-4 h-4" />}
            disabled={!canViewTransactions}
            activeTabOverride={activeTab}
          />
          <InventoryTabLink
            href={`/inventory/${itemId}?tab=maintenance`}
            label="Maintenance"
            icon={<Wrench className="w-4 h-4" />}
            disabled={!canViewMaintenance}
            activeTabOverride={activeTab}
          />
          <InventoryTabLink
            href={`/inventory/${itemId}?tab=audit`}
            label="Audit Logs"
            icon={<ClipboardList className="w-4 h-4" />}
            disabled={!canViewAudit}
            activeTabOverride={activeTab}
          />
        </div>

        <div className="p-4 bg-white rounded-md shadow-sm border">
          {activeTab === "overview" ? (
            canViewOverview ? (
              <InventoryDetails
                item={item}
                categories={categories}
                suppliers={suppliers}
                manufacturers={manufacturers}
              />
            ) : (
              <p className="text-sm text-gray-500">No access</p>
            )
          ) : (
            <InventoryTabContent
              inventoryId={itemId}
              activeTab={activeTab}
              canEditStock={canEditStock}
              canEditMaintenance={canEditMaintenance}
              canViewTransactions={canViewTransactions}
              canViewMaintenance={canViewMaintenance}
              canViewAudit={canViewAudit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

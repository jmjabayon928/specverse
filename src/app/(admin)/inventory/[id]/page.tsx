// src/app/(admin)/inventory/[id]/page.tsx
import { notFound } from "next/navigation";
import { LayoutDashboard, FileText, Wrench, ClipboardList } from "lucide-react";
import InventoryDetails from "@/components/inventory/InventoryDetails";
import InventoryTabLink from "@/components/inventory/InventoryTabLink";
import InventoryTabContent from "@/components/inventory/InventoryTabContent";
import { requireAuth } from "@/utils/sessionUtils.server";
import { PERMISSIONS } from "@/constants/permissions";
import { apiJson } from "@/utils/apiJson.server";
import type { InventoryItemDB } from "@/domain/inventory/inventoryTypes";

interface InventoryPageProps {
  params: Promise<{ id?: string }>;
  searchParams: Promise<{ tab?: string }>;
}

type ReferenceOption = { id: number; name: string };

function isReferenceOption(obj: unknown): obj is ReferenceOption {
  if (obj == null || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  const id = typeof o.id === 'number' ? o.id : typeof o.categoryId === 'number' ? o.categoryId : typeof o.suppId === 'number' ? o.suppId : typeof o.manuId === 'number' ? o.manuId : typeof o.warehouseId === 'number' ? o.warehouseId : null;
  const name = typeof o.name === 'string' ? o.name : typeof o.CategoryName === 'string' ? o.CategoryName : typeof o.suppName === 'string' ? o.suppName : typeof o.manuName === 'string' ? o.manuName : typeof o.warehouseName === 'string' ? o.warehouseName : null;
  return id != null && name != null;
}

function mapToReferenceOption(obj: unknown): ReferenceOption | null {
  if (!isReferenceOption(obj)) {
    const o = obj as Record<string, unknown>;
    const id = typeof o.categoryId === 'number' ? o.categoryId : typeof o.suppId === 'number' ? o.suppId : typeof o.manuId === 'number' ? o.manuId : typeof o.warehouseId === 'number' ? o.warehouseId : null;
    const name = typeof o.CategoryName === 'string' ? o.CategoryName : typeof o.suppName === 'string' ? o.suppName : typeof o.manuName === 'string' ? o.manuName : typeof o.warehouseName === 'string' ? o.warehouseName : null;
    if (id != null && name != null) {
      return { id, name };
    }
    return null;
  }
  return obj;
}

function mapToReferenceOptions(arr: unknown): ReferenceOption[] {
  if (!Array.isArray(arr)) return [];
  return arr.map(mapToReferenceOption).filter((item): item is ReferenceOption => item != null);
}

async function fetchInventoryItem(itemId: number): Promise<InventoryItemDB | null> {
  try {
    const data = await apiJson<InventoryItemDB>(
      `/api/backend/inventory/${itemId}`,
      { cache: 'no-store' }
    );
    
    if (typeof data.inventoryId !== 'number' || typeof data.quantityOnHand !== 'number') {
      return null;
    }
    
    return data;
  } catch (err) {
    if (err instanceof Error && err.message === 'Not found') {
      return null;
    }
    throw err;
  }
}

async function fetchReferenceOptions(): Promise<{
  categories: ReferenceOption[];
  suppliers: ReferenceOption[];
  manufacturers: ReferenceOption[];
}> {
  const data = await apiJson<{
    categories?: unknown;
    suppliers?: unknown;
    manufacturers?: unknown;
  }>(
    '/api/backend/inventory/reference-options',
    { cache: 'no-store' }
  );
  
  return {
    categories: mapToReferenceOptions(data.categories),
    suppliers: mapToReferenceOptions(data.suppliers),
    manufacturers: mapToReferenceOptions(data.manufacturers),
  };
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

  const item = await fetchInventoryItem(itemId);
  if (!item) return notFound();

  const { categories, suppliers, manufacturers } = await fetchReferenceOptions();
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

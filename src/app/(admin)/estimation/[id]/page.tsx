'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { Estimation, EstimationPackage, EstimationItem, SupplierQuote } from '@/types/estimation';
import EstimationForm from '@/components/estimation/EstimationForm';
import PackageForm from '@/components/estimation/PackageForm';
import ItemForm from '@/components/estimation/ItemForm';
import SupplierQuoteForm from '@/components/estimation/SupplierQuoteForm';

export default function EstimationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const estimationId = parseInt(params.id as string);
  const isEditing = searchParams.get('edit') === 'true';
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [packages, setPackages] = useState<EstimationPackage[]>([]);
  const [itemsByPackage, setItemsByPackage] = useState<Record<number, EstimationItem[]>>({});
  const [quotesByItem, setQuotesByItem] = useState<Record<number, SupplierQuote[]>>({});
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  const [showAddPackageForm, setShowAddPackageForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<EstimationPackage | null>(null);
  const [confirmDeletePackageId, setConfirmDeletePackageId] = useState<number | null>(null);

  const [showItemFormFor, setShowItemFormFor] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<EstimationItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<EstimationItem | null>(null);

  const [showQuoteFormFor, setShowQuoteFormFor] = useState<Record<number, boolean>>({});
  const [editingQuote, setEditingQuote] = useState<SupplierQuote | null>(null);
  const [confirmDeleteQuoteId, setConfirmDeleteQuoteId] = useState<number | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    if (!isNaN(estimationId)) {
      fetch(`${baseUrl}/api/backend/estimation/${estimationId}`)
        .then(res => res.json())
        .then(setEstimation)
        .catch(err => console.error('Failed to fetch estimation:', err))
        .finally(() => setLoading(false));
    }
  }, [estimationId, baseUrl]);

  useEffect(() => {
    if (!isNaN(estimationId)) {
      const fetchData = async () => {
        try {
          const packagesRes = await fetch(`/api/backend/estimation/packages?estimationId=${estimationId}`);
          const packages = await packagesRes.json();
          setPackages(packages);

          const itemMap: Record<number, EstimationItem[]> = {};
          for (const pkg of packages) {
            const res = await fetch(`/api/backend/estimation/items?packageId=${pkg.PackageID}`);
            const items = await res.json();
            itemMap[pkg.PackageID] = items;
          }
          setItemsByPackage(itemMap);
        } catch (err) {
          console.error('Error loading packages/items:', err);
        }
      };

      fetchData();
    }
  }, [estimationId]);

  const refreshEstimation = async () => {
    const res = await fetch(`/api/backend/estimation/${estimationId}`);
    const updated = await res.json();
    setEstimation(updated);
  };

  const handleDeleteQuote = async () => {
    if (!confirmDeleteQuoteId || !confirmDeleteItem?.EItemID) return;

    try {
      const res = await fetch(`${baseUrl}/api/backend/estimation/quotes/${confirmDeleteQuoteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData?.error || "Failed to delete quote.");
      } else {
        await refreshQuotes(confirmDeleteItem.EItemID);
        toast.success("Quote deleted successfully");
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("An unexpected error occurred.");
    } finally {
      setConfirmDeleteQuoteId(null);
      setConfirmDeleteItem(null);
    }
  };

  const fetchPackagesAndItems = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/backend/estimation/packages?estimationId=${estimationId}`);
      const pkgData = await res.json();
      if (!Array.isArray(pkgData)) throw new Error('Invalid packages response');
      setPackages(pkgData);

      const allItems: Record<number, EstimationItem[]> = {};
      for (const pkg of pkgData) {
        const itemRes = await fetch(`${baseUrl}/api/backend/estimation/items?packageId=${pkg.PackageID}`);
        const itemData = await itemRes.json();
        allItems[pkg.PackageID] = Array.isArray(itemData) ? itemData : [];
      }
      setItemsByPackage(allItems);
    } catch (err) {
      console.error('Failed to fetch packages/items:', err);
    }
  };

  const toggleQuotes = async (itemId: number) => {
    setExpandedItems(prev => ({ ...prev, [itemId]: !prev[itemId] }));

    if (!quotesByItem[itemId]) {
      try {
        const res = await fetch(`${baseUrl}/api/backend/estimation/quotes?itemId=${itemId}`);
        const data = await res.json();
        const sorted = (Array.isArray(data) ? data : []).sort((a, b) => {
          if (a.IsSelected === b.IsSelected) {
            return new Date(b.CreatedAt!).getTime() - new Date(a.CreatedAt!).getTime();
          }
          return a.IsSelected ? -1 : 1;
        });
        setQuotesByItem(prev => ({ ...prev, [itemId]: sorted }));
      } catch (err) {
        console.error('Failed to fetch quotes:', err);
      }
    }
  };

  const refreshQuotes = async (itemId: number) => {
    const res = await fetch(`${baseUrl}/api/backend/estimation/quotes?itemId=${itemId}`);
    const quoteData: SupplierQuote[] = await res.json();
    const sorted = Array.isArray(quoteData)
      ? quoteData.sort((a, b) =>
          a.IsSelected === b.IsSelected
            ? new Date(b.CreatedAt!).getTime() - new Date(a.CreatedAt!).getTime()
            : a.IsSelected
            ? -1
            : 1
        )
      : [];
    setQuotesByItem(prev => ({ ...prev, [itemId]: sorted }));
  };
  if (loading) return <div className="text-gray-500 p-4">Loading...</div>;
  if (!estimation) return <div className="text-red-500 p-4">Estimation not found.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      <div className="flex justify-between items-start">
        <h1 className="text-2xl font-bold text-blue-800">Estimation Details</h1>
        {!isEditing && (
          <a
            href={`/estimation/${estimationId}?edit=true`}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded shadow"
          >
            Edit Estimation
          </a>
        )}
      </div>

      {/* Estimation summary or edit form */}
      {isEditing ? (
        <EstimationForm
          defaultValues={estimation}
          mode="edit"
          onSubmitSuccess={() => window.location.href = `/estimation/${estimationId}`}
        />
      ) : (
        <div className="grid grid-cols-4 gap-4 bg-white p-4 rounded shadow text-sm">
          <div className="font-medium text-gray-600">Estimation ID</div>
          <div>{estimation.EstimationID}</div>
          <div className="font-medium text-gray-600">Title</div>
          <div>{estimation.Title}</div>

          <div className="font-medium text-gray-600">Client Name</div>
          <div>{estimation.ClientName || '-'}</div>
          <div className="font-medium text-gray-600">Description</div>
          <div>{estimation.Description || '-'}</div>

          <div className="font-medium text-gray-600">Project Name</div>
          <div>{estimation.ProjectName || '-'}</div>
          <div className="font-medium text-gray-600">Total Material Cost</div>
          <div>${estimation.TotalMaterialCost?.toFixed(2) || '0.00'}</div>

          <div className="font-medium text-gray-600">Currency</div>
          <div>{estimation.CurrencyCode || '-'}</div>
          <div className="font-medium text-gray-600">Status</div>
          <div>{estimation.Status}</div>

          <div className="font-medium text-gray-600">Created By</div>
          <div>{estimation.CreatedByName || '-'}</div>
          <div className="font-medium text-gray-600">Date Created</div>
          <div>{new Date(estimation.CreatedAt).toLocaleDateString()}</div>

          <div className="font-medium text-gray-600">Verified By</div>
          <div>{estimation.VerifiedByName || '-'}</div>
          <div className="font-medium text-gray-600">Approved By</div>
          <div>{estimation.ApprovedByName || '-'}</div>
        </div>
      )}

      {/* Package display */}
      {packages.map((pkg) => (
        <div key={pkg.PackageID} className="border border-gray-300 rounded shadow-sm bg-white">
          {/* Package header and controls */}
          <div className="px-4 pt-4 pb-2 bg-gray-100 border-b border-gray-300">
            <div className="flex justify-between items-start mb-3">
              {/* Package title */}
              {editingPackage?.PackageID !== pkg.PackageID && (
                <h3 className="text-lg font-bold text-gray-800">{pkg.PackageName}</h3>
              )}

              {/* Action buttons */}
              <div className="space-x-2">
                {!editingPackage || editingPackage.PackageID !== pkg.PackageID ? (
                  <>
                    <button
                      onClick={() => setEditingPackage(pkg)}
                      className="inline-flex items-center gap-1 bg-orange-400 hover:bg-orange-500 text-white text-sm px-3 py-1 rounded shadow"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => {
                        const hasItems = (itemsByPackage[pkg.PackageID] || []).length > 0;

                        if (hasItems) {
                          alert('Cannot delete: this package has items.');
                          return;
                        }

                        setConfirmDeletePackageId(pkg.PackageID); // open confirmation modal
                      }}
                      className="inline-flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 rounded shadow"
                    >
                      🗑️ Delete
                    </button>
                  </>
                ) : null}
              </div>

              {/* Edit Package Form */}
              {editingPackage?.PackageID === pkg.PackageID && (
                <div className="mt-4 border rounded-md p-4 shadow bg-white w-full">
                  <h3 className="text-md font-semibold mb-2">Edit Package Details</h3>
                  <PackageForm
                    estimationId={estimationId}
                    defaultValues={editingPackage}
                    mode="edit"
                    onSuccess={() => {
                      setEditingPackage(null);
                      fetchPackagesAndItems();
                    }}
                    onCancel={() => setEditingPackage(null)}
                  />
                </div>
              )}
            </div>

            {/* Package metadata table */}
            <div className="grid grid-cols-4 gap-4 text-sm text-gray-800">
              <div className="font-medium text-gray-600">Package Name</div>
              <div>{pkg.PackageName}</div>
              <div className="font-medium text-gray-600">Total Material Cost</div>
              <div>${pkg.TotalMaterialCost?.toFixed(2) || '0.00'}</div>

              <div className="font-medium text-gray-600">Description</div>
              <div>{pkg.Description || '-'}</div>
              <div className="font-medium text-gray-600">Total Labor Cost</div>
              <div>${pkg.TotalLaborCost?.toFixed(2) || '0.00'}</div>

              <div className="font-medium text-gray-600">Sequence</div>
              <div>{pkg.Sequence ?? '-'}</div>
              <div className="font-medium text-gray-600">Total Duration (days)</div>
              <div>{pkg.TotalDurationDays ?? '-'}</div>

              <div className="font-medium text-gray-600">Created By</div>
              <div>{pkg.CreatedByName || '-'}</div>
              <div className="font-medium text-gray-600">Date Created</div>
              <div>{pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : '-'}</div>

              <div className="font-medium text-gray-600">Modified By</div>
              <div>{pkg.ModifiedByName || '-'}</div>
              <div className="font-medium text-gray-600">Date Modified</div>
              <div>{pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : '-'}</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-gray-300 rounded-md p-4 mt-3 mx-4 mb-4">
            <table className="table-fixed w-full border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-2 py-1 w-1/5 text-left">Item Name</th>
                  <th className="border border-gray-300 px-2 py-1 w-1/12 text-left">Qty</th>
                  <th className="border border-gray-300 px-2 py-1 w-[32%] text-left">Description</th>
                  <th className="border border-gray-300 px-2 py-1 w-[10%] text-left">Created By</th>
                  <th className="border border-gray-300 px-2 py-1 w-[10%] text-left">Created At</th>
                  <th className="border border-gray-300 px-2 py-1 w-[10%] text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(itemsByPackage[pkg.PackageID] || []).map((item) =>
                  item ? (
                    <React.Fragment key={item.EItemID}>
                      {/* Item Row */}
                      <tr>
                        <td className="border border-gray-300 px-2 py-1">{item.ItemName || item.ItemID}</td>
                        <td className="border border-gray-300 px-2 py-1">{item.Quantity}</td>
                        <td className="border border-gray-300 px-2 py-1">{item.Description || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1">{item.CreatedByName || '-'}</td>
                        <td className="border border-gray-300 px-2 py-1">
                          {item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString() : '-'}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => setEditingItem(item)}
                              title="Edit Item"
                              className="text-amber-600 hover:text-amber-700"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => setConfirmDeleteItem(item)}
                              title="Delete Item"
                              className="text-red-600 hover:text-red-700"
                            >
                              🗑️
                            </button>
                            <button
                              onClick={() => toggleQuotes(item.EItemID)}
                              title={expandedItems[item.EItemID] ? "Hide Quotes" : "Show Quotes"}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              {expandedItems[item.EItemID] ? '🚫👁️' : '👁️'}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editingItem?.EItemID === item.EItemID && (
                        <tr>
                          <td colSpan={6} className="bg-blue-50 px-4 py-4">
                            <ItemForm
                              estimationId={estimationId}
                              packageId={pkg.PackageID}
                              defaultValues={editingItem}
                              mode="edit"
                              onSuccess={() => {
                                setEditingItem(null);
                                fetchPackagesAndItems();
                              }}
                              onCancel={() => setEditingItem(null)}
                            />
                          </td>
                        </tr>
                      )}

                      {/* Quotes Table Row (if expanded) */}
                      {expandedItems[item.EItemID] && (
                        <tr>
                          <td colSpan={6} className="bg-green-50 border border-t-0 border-gray-300 px-2 py-2">
                            <div className="rounded-md">
                              <table className="w-full table-fixed border border-gray-300 text-sm">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="border border-gray-300 px-2 py-1 w-1/6 text-left">Supplier</th>
                                    <th className="border border-gray-300 px-2 py-1 w-1/6 text-right">Unit Cost</th>
                                    <th className="border border-gray-300 px-2 py-1 w-1/6 text-center">Delivery (days)</th>
                                    <th className="border border-gray-300 px-2 py-1 w-1/12 text-center">Currency</th>
                                    <th className="border border-gray-300 px-2 py-1 w-1/12 text-center">Selected</th>
                                    <th className="border border-gray-300 px-2 py-1 w-1/4 text-left">Notes</th>
                                    <th className="border border-gray-300 px-2 py-1 w-1/12 text-center">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(quotesByItem[item.EItemID] || []).map((quote) => (
                                    <React.Fragment key={quote.QuoteID}>
                                      <tr className="bg-white">
                                        <td className="border px-2 py-1">{quote.SupplierName}</td>
                                        <td className="border px-2 py-1 text-right">${quote.QuotedUnitCost.toFixed(2)}</td>
                                        <td className="border px-2 py-1 text-center">{quote.ExpectedDeliveryDays ?? '-'}</td>
                                        <td className="border px-2 py-1 text-center">{quote.CurrencyCode || '-'}</td>
                                        <td className="border px-2 py-1 text-center">{quote.IsSelected ? '✔' : ''}</td>
                                        <td className="border px-2 py-1">{quote.Notes || '-'}</td>
                                        <td className="border px-2 py-1 text-center">
                                          <div className="flex justify-center gap-2">
                                            {!quote.IsSelected && (
                                              <>
                                                <button
                                                  onClick={() => setEditingQuote(quote)}
                                                  title="Edit Quote"
                                                  className="text-amber-600 hover:text-amber-700"
                                                >
                                                  ✏️
                                                </button>
                                                <button
                                                  onClick={() => setConfirmDeleteQuoteId(quote.QuoteID)}
                                                  title="Delete Quote"
                                                  className="text-red-600 hover:text-red-700"
                                                >
                                                  🗑️
                                                </button>
                                                <button
                                                  disabled={isSelecting}
                                                  onClick={async () => {
                                                    setIsSelecting(true);
                                                    try {
                                                      await fetch(`${baseUrl}/api/backend/estimation/quotes/select/${quote.QuoteID}`, {
                                                        method: "POST",
                                                      });
                                                      await refreshQuotes(item.EItemID);
                                                      await fetchPackagesAndItems();
                                                      await refreshEstimation();
                                                    } finally {
                                                      setIsSelecting(false);
                                                    }
                                                  }}
                                                >
                                                  {isSelecting ? "..." : "🏆"}
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </td>
                                      </tr>

                                      {/* 👇 Quote Edit Row */}
                                      {editingQuote?.QuoteID === quote.QuoteID && (
                                        <tr>
                                          <td colSpan={7} className="bg-green-50 px-4 py-4">
                                            <SupplierQuoteForm
                                              itemId={item.EItemID}
                                              defaultValues={editingQuote}
                                              mode="edit"
                                              onSuccess={() => {
                                                setEditingQuote(null);
                                                refreshQuotes(item.EItemID);
                                              }}
                                              onCancel={() => setEditingQuote(null)}
                                            />
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>

                              {/* Toggle Add Quote Button */}
                              <div className="mt-3 text-right">
                                <button
                                  onClick={() =>
                                    setShowQuoteFormFor((prev) => ({
                                      ...prev,
                                      [item.EItemID]: !prev?.[item.EItemID],
                                    }))
                                  }
                                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded shadow"
                                >
                                  {showQuoteFormFor?.[item.EItemID] ? 'Cancel' : '+ Add Supplier Quote'}
                                </button>
                              </div>

                              {/* Add New Quote Form */}
                              {showQuoteFormFor?.[item.EItemID] && (
                                <div className="mt-3">
                                  <SupplierQuoteForm
                                    itemId={item.EItemID}
                                    onSuccess={() => {
                                      setShowQuoteFormFor((prev) => ({
                                        ...prev,
                                        [item.EItemID]: false,
                                      }));
                                      refreshQuotes(item.EItemID);
                                    }}
                                    onCancel={() =>
                                      setShowQuoteFormFor((prev) => ({
                                        ...prev,
                                        [item.EItemID]: false,
                                      }))
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ) : null
                )}
              </tbody>
            </table>

            {/* Add Item Form */}
            {showItemFormFor === pkg.PackageID ? (
              <div className="mt-4">
                <ItemForm
                  estimationId={estimationId}
                  packageId={pkg.PackageID}
                  onSuccess={() => {
                    setShowItemFormFor(null);
                    fetchPackagesAndItems();
                  }}
                  onCancel={() => setShowItemFormFor(null)}
                />
              </div>
            ) : (
              <div className="mt-4">
                <button
                  onClick={() => setShowItemFormFor(pkg.PackageID)}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-1.5 rounded shadow-sm"
                >
                  + Add Item
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Add new package */}
      {showAddPackageForm ? (
        <div className="border rounded p-4 shadow bg-white">
          <h3 className="font-semibold mb-2">New Package</h3>
          <PackageForm
            estimationId={estimation.EstimationID}
            mode="create"
            onSuccess={() => {
              setShowAddPackageForm(false);
              fetchPackagesAndItems();
            }}
            onCancel={() => setShowAddPackageForm(false)}
          />
          <button
            onClick={() => setShowAddPackageForm(false)}
            className="text-sm text-gray-500 hover:underline mt-2"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowAddPackageForm(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow text-sm"
        >
          + Add Package
        </button>
      )}

      {confirmDeletePackageId !== null && (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded shadow-lg max-w-sm w-full">
          <p className="mb-4 text-sm text-gray-800">
            Are you sure you want to delete this package? It must not have any items.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDeletePackageId(null)}
              className="text-gray-600 hover:text-gray-800 text-sm"
            >
              Cancel
            </button>
            <button
              className="text-red-600 hover:text-red-800 font-semibold text-sm"
              onClick={async () => {
                const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

                try {
                  const res = await fetch(
                    `${baseUrl}/api/backend/estimation/packages/${confirmDeletePackageId}`,
                    { method: 'DELETE' }
                  );

                  if (!res.ok) {
                    const errData = await res.json();
                    alert(errData.error || 'Failed to delete package.');
                  } else {
                    setConfirmDeletePackageId(null);
                    fetchPackagesAndItems();
                  }
                } catch (err) {
                  console.error('Delete failed:', err);
                  alert('Failed to delete package.');
                }
              }}
            >
              Yes, Delete
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {confirmDeleteItem && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow max-w-sm">
            <p className="text-sm text-gray-700 mb-4">
              Are you sure you want to delete this item?
            </p>

            {/* Check if item has quotes */}
            {quotesByItem[confirmDeleteItem.EItemID]?.length > 0 ? (
              <p className="text-red-600 text-sm mb-4">
                Cannot delete: item has supplier quotes.
              </p>
            ) : (
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDeleteItem(null)}
                  className="text-gray-500 hover:underline"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
                    await fetch(
                      `${baseUrl}/api/backend/estimation/items/${confirmDeleteItem.EItemID}`,
                      { method: 'DELETE' }
                    );
                    setConfirmDeleteItem(null);
                    fetchPackagesAndItems();
                  }}
                  className="text-red-600 hover:underline"
                >
                  Yes, Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDeleteQuoteId && (
      <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded shadow max-w-sm">
          <p className="text-sm text-gray-700 mb-4">
            Are you sure you want to delete this supplier quote?
          </p>

          {/* 🚫 Check if quote has a selected item */}
          {quotesByItem[confirmDeleteItem?.EItemID || 0]?.find(q => q.QuoteID === confirmDeleteQuoteId)?.IsSelected ? (
            <p className="text-red-600 text-sm mb-4">
              Cannot delete: this quote is marked as selected.
            </p>
          ) : (
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setConfirmDeleteQuoteId(null);
                  setConfirmDeleteItem(null);
                }}
                className="text-gray-500 hover:underline"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteQuote}
                className="text-red-600 hover:underline"
              >
                Yes, Delete
              </button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

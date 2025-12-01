// src/app/(admin)/estimation/packages/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EstimationPackage, EstimationItem } from "@/domain/estimations/estimationTypes";
import ItemForm from "@/components/estimation/ItemForm";

export default function PackageDetailPage() {
  const { id } = useParams();
  const packageId = parseInt(id as string);
  const [pkg, setPkg] = useState<EstimationPackage | null>(null);
  const [items, setItems] = useState<EstimationItem[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!isNaN(packageId)) {
      const fetchData = async () => {
        const res1 = await fetch(`/api/backend/estimation/packages/${packageId}`);
        setPkg(await res1.json());

        const res2 = await fetch(`/api/backend/estimation/items?packageId=${packageId}`);
        setItems(await res2.json());
      };

      fetchData();
    }
  }, [packageId]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">Package: {pkg?.PackageName}</h1>

      <div className="overflow-x-auto mt-4">
        <table className="min-w-full text-sm border border-gray-200 shadow-sm rounded-md">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
            <tr>
                <th className="px-4 py-2 text-left">Part</th>
                <th className="px-4 py-2 text-left">Qty</th>
                <th className="px-4 py-2 text-left">Unit Cost</th>
                <th className="px-4 py-2 text-left">Total</th>
                <th className="px-4 py-2 text-left">Actions</th>
            </tr>
            </thead>
            <tbody>
            {items.length > 0 ? (
                items.map((item) => (
                <tr key={item.EItemID} className="border-t">
                    <td className="px-4 py-2">{item.ItemName ?? "Unnamed"}</td>
                    <td className="px-4 py-2">{item.Quantity}</td>
                    <td className="px-4 py-2">${(item.UnitCost ?? 0).toFixed(2)}</td>
                    <td className="px-4 py-2">${((item.Quantity ?? 0) * (item.UnitCost ?? 0)).toFixed(2)}</td>
                    <td className="px-4 py-2">
                    <a
                        href={`/estimation/quotes/${item.ItemID}`}
                        className="text-blue-600 hover:underline"
                    >
                        View Quotes
                    </a>
                    </td>
                </tr>
                ))
            ) : (
                <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    No items added yet.
                </td>
                </tr>
            )}
            </tbody>
          </table>
        </div>

      <button
        onClick={() => setShowForm(!showForm)}
        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm text-sm"
      >
        {showForm ? "Cancel" : "Add Item"}
      </button>

      {showForm && pkg?.EstimationID && (
        <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow border mt-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Add New Item</h2>
          <ItemForm
            mode="create"
            estimationId={pkg.EstimationID}
            packageId={packageId}
            items={items}
            inventoryItems={[]} 
            onSuccess={() => window.location.reload()}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}

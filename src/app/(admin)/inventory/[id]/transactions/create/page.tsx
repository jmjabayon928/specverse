"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface CreateTransactionPageProps {
  params: { id: string };
}

export default function CreateTransactionPage({ params }: Readonly<CreateTransactionPageProps>) {
  const router = useRouter();
  const [transactionType, setTransactionType] = useState("Receive");
  const [quantityChanged, setQuantityChanged] = useState<number | "">("");
  const [uom, setUom] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ AFTER hooks → safe to check params
  const inventoryId = Number(params?.id ?? "0");
  if (!inventoryId || isNaN(inventoryId)) {
    // ✅ fallback: navigate back or show error
    router.push("/inventory");   // or use a custom error page
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!quantityChanged || Number(quantityChanged) <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}/transactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionType,
            quantityChanged: Number(quantityChanged),
            uom,
            referenceNote,
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to add transaction.");

      router.push(`/inventory/${inventoryId}?tab=transactions`);
    } catch (err) {
      console.error(err);
      alert("Error adding transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded shadow">
      <h2 className="text-2xl font-semibold mb-4">Add Stock Transaction</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="Type of Transaction" className="block text-sm font-medium mb-1">Transaction Type</label>
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            aria-label="Transaction Type"
          >
            <option value="Receive">Receive</option>
            <option value="Issue">Issue</option>
            <option value="Adjustment">Adjustment</option>
          </select>
        </div>

        <div>
          <label htmlFor="Quantity Changed" className="block text-sm font-medium mb-1">Quantity Changed</label>
          <input
            type="number"
            value={quantityChanged}
            onChange={(e) => setQuantityChanged(
              e.target.value === "" ? "" : Number(e.target.value)
            )}
            min="0"
            step="any"
            className="border rounded px-3 py-2 w-full"
            aria-label="Quantity Changed"
          />
        </div>

        <div>
          <label htmlFor="UOM" className="block text-sm font-medium mb-1">UOM (optional)</label>
          <input
            type="text"
            value={uom}
            onChange={(e) => setUom(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            aria-label="UOM"
          />
        </div>

        <div>
          <label htmlFor="Reference Note" className="block text-sm font-medium mb-1">Reference Note (optional)</label>
          <textarea
            value={referenceNote}
            onChange={(e) => setReferenceNote(e.target.value)}
            rows={3}
            className="border rounded px-3 py-2 w-full"
            aria-label="Reference Note"
          />
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => router.push(`/inventory/${inventoryId}?tab=transactions`)}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {isSubmitting ? "Saving..." : "Save Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}

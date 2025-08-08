// src/app/(admin)/estimation/quotes/[itemId]/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { SupplierQuote } from "@/types/estimation";
import SupplierQuotesTable from "@/components/estimation/SupplierQuotesTable";
import SupplierQuoteForm from "@/components/estimation/SupplierQuoteForm";

export default function QuotesPage() {
  const { itemId } = useParams();
  const parsedItemId = parseInt(itemId as string);
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [showForm, setShowForm] = useState(false);

  const fetchQuotes = useCallback(async () => {
    const res = await fetch(`/api/backend/estimation/quotes?itemId=${parsedItemId}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      setQuotes(data);
    } else {
      console.error("Invalid quotes response:", data);
      setQuotes([]);
    }
  }, [parsedItemId]);

  useEffect(() => {
    if (!isNaN(parsedItemId)) fetchQuotes();
  }, [fetchQuotes, parsedItemId]);

  const handleSelectQuote = async (quoteId: number) => {
    await fetch(`/api/backend/estimation/quotes/select/${quoteId}`, {
      method: "POST",
    });
    fetchQuotes();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">
        Supplier Quotes for Item {parsedItemId}
      </h1>

      <SupplierQuotesTable quotes={quotes} onSelectQuote={handleSelectQuote} />

      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm shadow mt-4"
      >
        {showForm ? "Cancel" : "Add Supplier Quote"}
      </button>

      {showForm && (
        <div className="max-w-3xl bg-white border border-gray-200 p-6 mt-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            Add Supplier Quote
          </h2>
          <SupplierQuoteForm
            mode="create"
            itemId={parsedItemId}
            quotes={quotes}
            onSuccess={fetchQuotes}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}
    </div>
  );
}

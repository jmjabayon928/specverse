"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SupplierQuote } from "@/types/estimation";

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<SupplierQuote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const res = await fetch("/api/backend/estimation/quotes/all", {
          headers: {
            Cookie: document.cookie, // send session cookie
          },
          credentials: "include", // very important for SSR/Edge
        });
        if (!res.ok) throw new Error("Failed to fetch quotes");
        const data = await res.json();
        setQuotes(data);
      } catch (err) {
        console.error("Error loading quotes:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, []);

  if (loading) {
    return <div className="p-4 text-gray-600">Loading quotes...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">All Supplier Quotes</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-300 shadow-sm rounded-md">
          <thead className="bg-gray-100 text-gray-700 font-semibold">
            <tr>
              <th className="px-4 py-2 text-left">Quote ID</th>
              <th className="px-4 py-2 text-left">Supplier</th>
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-4 py-2 text-left">Quoted Price</th>
              <th className="px-4 py-2 text-left">Lead Time</th>
              <th className="px-4 py-2 text-left">Selected</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotes.length > 0 ? (
              quotes.map((quote) => (
                <tr key={quote.QuoteID} className="border-t">
                  <td className="px-4 py-2">{quote.QuoteID}</td>
                  <td className="px-4 py-2">{quote.SupplierName}</td>
                  <td className="px-4 py-2">{quote.ItemName ?? "Unnamed"}</td>
                  <td className="px-4 py-2">{quote.QuotedUnitCost != null ? `$${quote.QuotedUnitCost.toFixed(2)}` : "$0.00"}</td>
                  <td className="px-4 py-2">{quote.ExpectedDeliveryDays != null ? `${quote.ExpectedDeliveryDays} days` : "-"}</td>
                  <td className="px-4 py-2">{quote.IsSelected ? "Yes" : "No"}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/estimation/quotes/${quote.ItemID}`}
                      className="text-blue-600 hover:underline"
                    >
                      View Item Quotes
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-4 text-gray-500">
                  No quotes found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

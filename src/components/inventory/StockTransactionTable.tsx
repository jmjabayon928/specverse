"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkUserPermission } from "@/utils/permissionUtils";

interface Transaction {
  transactionId: number;
  transactionType: string;
  quantityChanged: number;
  uom?: string;
  referenceNote?: string;
  PerformedByName: string;
  performedAt?: string;
}

interface Props {
  inventoryId: number;
}

export default function StockTransactionTable({ inventoryId }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const canAdd = checkUserPermission("INVENTORY_TRANSACTION_CREATE");

  useEffect(() => {
    async function fetchTransactions() {
      try {
        console.log("Fetching from:", `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}/transactions`);

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}/transactions`
        );
        if (!res.ok) throw new Error("Failed to load transactions");
        const data = await res.json();
        console.log("Transactions fetched:", data);   // ✅ ADD THIS LINE
        setTransactions(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [inventoryId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Stock Transactions</h2>
        {canAdd && (
          <button
            onClick={() => router.push(`/inventory/${inventoryId}/transactions/create`)}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            + Add Transaction
          </button>
        )}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto border rounded-md bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3">UOM</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3 text-right">System User</th>
                <th className="px-4 py-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {transactions.map((tx) => (
                <tr key={tx.transactionId}>
                  <td className="px-4 py-2 font-medium">{tx.transactionType}</td>
                  <td className="px-4 py-2 text-right">{tx.quantityChanged}</td>
                  <td className="px-4 py-2">{tx.uom ?? "-"}</td>
                  <td className="px-4 py-2">{tx.referenceNote ?? "-"}</td>
                  <td className="px-4 py-2 text-right">{tx.PerformedByName}</td>
                  <td className="px-4 py-2 text-right">
                    {tx.performedAt ? new Date(tx.performedAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

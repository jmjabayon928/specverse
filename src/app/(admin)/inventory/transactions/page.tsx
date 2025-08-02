// src/app/(admin)/inventory/transactions/page.tsx
"use client";

import { useEffect, useState } from "react";

interface GlobalTransaction {
  transactionId: number;
  inventoryId: number;
  itemName: string;
  quantity: number;
  type: string;
  transactionDate: string;
  performedBy: string;
}

export default function GlobalTransactionsPage() {
  const [transactions, setTransactions] = useState<GlobalTransaction[]>([]);

  useEffect(() => {
    fetch("/api/backend/inventory/all/transactions")
      .then((res) => res.json())
      .then((data) => setTransactions(data))
      .catch((err) => console.error("Failed to load global transactions:", err));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">All Stock Transactions</h1>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Performed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.transactionId}>
                <td className="px-4 py-2">{tx.itemName}</td>
                <td className="px-4 py-2">{tx.quantity}</td>
                <td className="px-4 py-2">{tx.type}</td>
                <td className="px-4 py-2">{new Date(tx.transactionDate).toLocaleDateString()}</td>
                <td className="px-4 py-2">{tx.performedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

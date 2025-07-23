"use client";

import React, { useEffect, useState } from "react";

interface StockTransaction {
  id: number;
  itemName: string;
  quantity: number;
  transactionType: string;
  date: string;
  performedBy: string;
}

interface Props {
  inventoryId: number;
  canEdit: boolean;
}

export default function StockTransactionTable({ inventoryId, canEdit }: Props) {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const res = await fetch(`/api/backend/inventory/${inventoryId}/transactions`);
        const data = await res.json();
        setTransactions(data);
      } catch (error) {
        console.error("Failed to fetch stock transactions:", error);
      }
    }

    if (inventoryId) {
      fetchTransactions();
    }
  }, [inventoryId]);

  return (
    <div className="mt-4 border rounded-md">
      <div className="bg-gray-100 px-4 py-2 font-semibold">Stock Transactions</div>
      <table className="w-full border-t text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 border">Item</th>
            <th className="px-4 py-2 border">Quantity</th>
            <th className="px-4 py-2 border">Type</th>
            <th className="px-4 py-2 border">Date</th>
            <th className="px-4 py-2 border">Performed By</th>
            {canEdit && <th className="px-4 py-2 border">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.id}>
              <td className="px-4 py-2 border">{tx.itemName}</td>
              <td className="px-4 py-2 border">{tx.quantity}</td>
              <td className="px-4 py-2 border">{tx.transactionType}</td>
              <td className="px-4 py-2 border">{new Date(tx.date).toLocaleDateString()}</td>
              <td className="px-4 py-2 border">{tx.performedBy}</td>
              {canEdit && (
                <td className="px-4 py-2 border text-blue-500 hover:underline cursor-pointer">
                  Edit
                </td>
              )}
            </tr>
          ))}
          {transactions.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 6 : 5} className="px-4 py-2 border text-center text-gray-500">
                No transactions found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

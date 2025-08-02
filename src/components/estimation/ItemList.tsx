// src/components/estimation/ItemList.tsx
import React from "react";
import { EstimationItem } from "@/types/estimation";

interface ItemListProps {
    items: EstimationItem[];
    onViewQuotes?: (itemId: number) => void;
}

export default function ItemList({ items, onViewQuotes }: ItemListProps) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full text-sm border border-gray-200 shadow-sm rounded-md">
                <thead className="bg-gray-100 text-gray-700 font-semibold">
                    <tr>
                        <th className="px-4 py-2">Part Name</th>
                        <th className="px-4 py-2">Quantity</th>
                        <th className="px-4 py-2">UOM</th>
                        <th className="px-4 py-2">Unit Cost</th>
                        <th className="px-4 py-2">Total</th>
                        <th className="px-4 py-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => (
                        <tr key={item.ItemID} className="border-b">
                            <td className="px-4 py-2">{item.ItemName}</td>
                            <td className="px-4 py-2">{item.Quantity}</td>
                            <td className="px-4 py-2">{item.UOM ?? "-"}</td>
                            <td className="px-4 py-2">{item.UnitCost !== undefined ? `$${item.UnitCost.toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-2">{item.UnitCost !== undefined ? `$${(item.Quantity * item.UnitCost).toFixed(2)}` : '-'}</td>
                            <td className="px-4 py-2">
                                <button
                                    onClick={() => onViewQuotes?.(item.ItemID)}
                                    className="text-blue-600 hover:text-blue-800 text-sm"
                                >
                                    View Quotes
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

import React from "react";
import { SupplierQuote } from "@/domain/estimations/estimationTypes";

interface SupplierQuotesTableProps {
    quotes: SupplierQuote[];
    onSelectQuote?: (quoteId: number) => void;
}

export default function SupplierQuotesTable({ quotes, onSelectQuote }: SupplierQuotesTableProps) {
    if (!Array.isArray(quotes)) {
        return <div className="text-red-600">Error: Invalid quotes data</div>;
    }
    
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-md">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2">Supplier</th>
                        <th className="px-4 py-2">Quoted Unit Cost</th>
                        <th className="px-4 py-2">Currency</th>
                        <th className="px-4 py-2">Delivery Days</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {quotes.map(quote => (
                        <tr key={quote.QuoteRowID} className="border-b">
                            <td className="px-4 py-2">{quote.SupplierName || `ID: ${quote.SupplierID}`}</td>
                            <td className="px-4 py-2">${quote.QuotedUnitCost.toFixed(2)}</td>
                            <td className="px-4 py-2">{quote.CurrencyCode ?? "USD"}</td>
                            <td className="px-4 py-2">{quote.ExpectedDeliveryDays ?? "-"}</td>
                            <td className="px-4 py-2">
                                {quote.IsSelected ? (
                                    <span className="text-green-600 font-semibold">Selected</span>
                                ) : (
                                    <span className="text-gray-500">Not Selected</span>
                                )}
                            </td>
                            <td className="px-4 py-2">
                                {!quote.IsSelected && (
                                    <button
                                        onClick={() => onSelectQuote?.(quote.QuoteID)}
                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                    >
                                        Select
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

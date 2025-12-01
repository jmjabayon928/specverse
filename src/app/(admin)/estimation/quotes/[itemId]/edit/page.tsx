// src/app/(admin)/estimation/quotes/[itemId]/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SupplierQuoteForm from '@/components/estimation/SupplierQuoteForm';
import { SupplierQuote } from '@/domain/estimations/estimationTypes';

export default function EditQuotePage() {
  const { id } = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<SupplierQuote | null>(null);

  useEffect(() => {
    const fetchQuote = async () => {
      const res = await fetch(`/api/estimation/quotes/${id}`);
      const data = await res.json();
      setQuote(data);
    };
    if (id) fetchQuote();
  }, [id]);

  if (!quote) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Edit Supplier Quote</h1>
      <SupplierQuoteForm
        mode="edit"
        defaultValues={{
          QuoteID: quote.QuoteID,
          SupplierID: quote.SupplierID,
          UnitCost: quote.QuotedUnitCost ?? 0, 
          Currency: quote.SupplierCurrency ?? "USD", 
          ExpectedDeliveryDays: quote.SupplierDeliveryDays ?? 0,
          Notes: quote.Notes ?? "",
        }}
        itemId={quote.ItemID}
        quotes={[]} 
        onSuccess={() => router.push(`/estimation/items/${quote.ItemID}`)}
        onCancel={() => router.back()}
      />
    </div>
  );
}

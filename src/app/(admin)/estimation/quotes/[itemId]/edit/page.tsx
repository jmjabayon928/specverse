'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SupplierQuoteForm from '@/components/estimation/SupplierQuoteForm';
import { SupplierQuote } from '@/types/estimation';

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
        defaultValues={quote}
        onSubmitSuccess={() => router.push(`/estimation/items/${quote.ItemID}`)}
      />
    </div>
  );
}

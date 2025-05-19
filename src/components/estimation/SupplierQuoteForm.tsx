'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SupplierQuote, Supplier } from '@/types/estimation';

type QuoteFormValues = {
  SupplierID: string; 
  QuotedUnitCost: number;
  ExpectedDeliveryDays?: number;
  CurrencyCode?: string;
  Notes?: string;
};

export type SupplierQuoteFormProps = {
  itemId: number;
  defaultValues?: SupplierQuote;
  mode?: "edit" | "create"; 
  onSuccess: () => void;
  onCancel?: () => void;
};

export default function SupplierQuoteForm({
  itemId,
  defaultValues,
  onSuccess,
  onCancel,
}: SupplierQuoteFormProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const isEditMode = !!defaultValues?.QuoteID;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    defaultValues: {
      SupplierID: defaultValues?.SupplierID ? String(defaultValues.SupplierID) : '',
      QuotedUnitCost: defaultValues?.QuotedUnitCost ?? 0,
      ExpectedDeliveryDays: defaultValues?.ExpectedDeliveryDays ?? undefined,
      CurrencyCode: defaultValues?.CurrencyCode ?? '',
      Notes: defaultValues?.Notes ?? '',
    },
  });

  // Fetch suppliers on load
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch('/api/backend/datasheets/templates/reference-options', {
          cache: 'no-store',
        });

        if (!res.ok) {
          console.error('Failed to fetch suppliers:', res.statusText);
          return;
        }

        const data = await res.json();
        console.log('Fetched supplier data:', data);

        // ✅ Normalize the structure from { id, name } to { SupplierID, SuppName }
        const raw = data.suppliers || [];

        const normalized: Supplier[] = (raw as unknown[])
          .filter((s: unknown): s is { id: number; name: string } => {
            const obj = s as Record<string, unknown>;
            return typeof obj.id === 'number' && typeof obj.name === 'string';
          })
          .map((s) => ({
            SupplierID: s.id,
            SuppName: s.name,
          }));

        setSuppliers(normalized);
      } catch (err) {
        console.error('Error fetching suppliers:', err);
      }
    };

    fetchSuppliers();
  }, []);

  // Reset form if editing
  useEffect(() => {
    if (
      defaultValues &&
      suppliers.length > 0 
    ) {
      reset({
        SupplierID: defaultValues.SupplierID ? String(defaultValues.SupplierID) : '',
        QuotedUnitCost: defaultValues.QuotedUnitCost,
        ExpectedDeliveryDays: defaultValues.ExpectedDeliveryDays,
        CurrencyCode: defaultValues.CurrencyCode ?? '',
        Notes: defaultValues.Notes ?? '',
      });
    }
  }, [defaultValues, suppliers, reset]);

  const onSubmit = async (data: QuoteFormValues) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
      const url = isEditMode
        ? `${baseUrl}/api/backend/estimation/quotes/${defaultValues!.QuoteID}`
        : `${baseUrl}/api/backend/estimation/quotes/create`;

      const res = await fetch(url, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          SupplierID: parseInt(data.SupplierID, 10), // Convert back to number
          ItemID: itemId,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        console.error('Save failed:', msg);
        throw new Error('Save failed');
      }

      onSuccess();
      if (!isEditMode) reset();
    } catch (err) {
      console.error('Supplier quote form error:', err);
      alert('Failed to save supplier quote.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-sm">
      {/* Row 1: Supplier + Unit Cost */}
      <div className="flex gap-4">
        <div className="w-1/2">
          <label className="block mb-1 font-medium">Supplier</label>
          <select {...register('SupplierID', { required: true })} className="input w-full">
            <option value="">-- Select Supplier --</option>
            {suppliers
              .filter((s) => s.SupplierID && s.SuppName)
              .map((s) => (
                <option key={`supplier-${s.SupplierID}`} value={String(s.SupplierID)}>
                  {s.SuppName}
                </option>
              ))}
          </select>
          {errors.SupplierID && <p className="text-red-500 text-xs">Required.</p>}
        </div>

        <div className="w-1/2">
          <label className="block mb-1 font-medium">Unit Cost</label>
          <input
            type="number"
            step="0.01"
            {...register('QuotedUnitCost', { required: true })}
            className="input w-full"
          />
          {errors.QuotedUnitCost && <p className="text-red-500 text-xs">Required.</p>}
        </div>
      </div>

      {/* Row 2: Currency + Delivery Days */}
      <div className="flex gap-4">
        <div className="w-1/2">
          <label className="block mb-1 font-medium">Currency</label>
          <input type="text" {...register('CurrencyCode')} className="input w-full" />
        </div>
        <div className="w-1/2">
          <label className="block mb-1 font-medium">Expected Delivery Days</label>
          <input type="number" {...register('ExpectedDeliveryDays')} className="input w-full" />
        </div>
      </div>

      {/* Row 3: Notes */}
      <div>
        <label className="block mb-1 font-medium">Notes</label>
        <textarea {...register('Notes')} className="input w-full" rows={2} />
      </div>

      {/* Row 4: Buttons */}
      <div className="flex justify-between">
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded shadow"
        >
          {isEditMode ? 'Update Quote' : 'Add Quote'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded shadow"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

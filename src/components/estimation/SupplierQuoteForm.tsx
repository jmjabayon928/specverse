"use client";

import { useForm } from "react-hook-form";
import { useEffect, useState } from "react";
import { SupplierQuote } from "@/types/estimation";

export type SupplierQuoteFormProps = {
  itemId?: number; // Only used for create mode
  defaultValues?: SupplierQuote;
  mode?: "create" | "edit";
  onSubmitSuccess?: () => void;
};

interface QuoteFormData {
  SupplierID: number;
  QuotedUnitCost: number;
  ExpectedDeliveryDays: number;
  CurrencyCode?: string;
  Notes?: string;
}

const currencyOptions = [
  "USD", "CAD", "EUR", "GBP", "JPY", "AUD", "CHF", "CNY", "HKD", "SGD",
  "INR", "PHP", "THB", "KRW", "NZD", "SEK", "NOK", "DKK", "ZAR", "BRL"
];

export default function SupplierQuoteForm({
  itemId,
  defaultValues,
  mode = "create",
  onSubmitSuccess,
}: SupplierQuoteFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<QuoteFormData>({
    defaultValues: {
      SupplierID: defaultValues?.SupplierID || undefined,
      QuotedUnitCost: defaultValues?.QuotedUnitCost || undefined,
      ExpectedDeliveryDays: defaultValues?.ExpectedDeliveryDays || undefined,
      CurrencyCode: defaultValues?.CurrencyCode || "",
      Notes: defaultValues?.Notes || "",
    },
  });

  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("/api/backend/datasheets/templates/reference-options");
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      } catch (err) {
        console.error("Failed to load suppliers:", err);
      }
    };

    fetchSuppliers();
  }, []);

  const onSubmit = async (data: QuoteFormData) => {
    try {
      const response = await fetch(
        mode === "edit"
          ? `/api/backend/estimation/quotes/${defaultValues?.QuoteID}`
          : `/api/backend/estimation/quotes/create`,
        {
          method: mode === "edit" ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "edit" ? data : { ...data, ItemID: itemId }
          ),
        }
      );

      if (!response.ok) throw new Error("Quote save failed");

      if (mode === "create") {
        reset(); // Clear form only for creation
        alert("Supplier quote added successfully!");
      } else {
        alert("Quote updated successfully!");
      }

      if (onSubmitSuccess) onSubmitSuccess();
    } catch (err) {
      console.error("Quote submit error:", err);
      alert("Failed to save quote.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Supplier Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
        <select
          {...register("SupplierID", { required: true })}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          <option value="">-- Select Supplier --</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {errors.SupplierID && (
          <p className="text-red-500 text-sm mt-1">Supplier is required.</p>
        )}
      </div>

      {/* Quoted Unit Cost */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Quoted Unit Cost</label>
        <input
          type="number"
          step="0.01"
          {...register("QuotedUnitCost", { required: true })}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        {errors.QuotedUnitCost && (
          <p className="text-red-500 text-sm mt-1">Unit cost is required.</p>
        )}
      </div>

      {/* Delivery Days */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery (Days)</label>
        <input
          type="number"
          {...register("ExpectedDeliveryDays", { required: true })}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        {errors.ExpectedDeliveryDays && (
          <p className="text-red-500 text-sm mt-1">Delivery days required.</p>
        )}
      </div>

      {/* Currency Dropdown */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
        <select
          {...register("CurrencyCode", { required: true })}
          className="w-full border rounded px-3 py-2 text-sm"
        >
          <option value="">-- Select Currency --</option>
          {currencyOptions.map((code) => (
            <option key={code} value={code}>{code}</option>
          ))}
        </select>
        {errors.CurrencyCode && (
          <p className="text-red-500 text-sm mt-1">Currency is required.</p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          {...register("Notes")}
          className="w-full border rounded px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      {/* Submit */}
      <div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm shadow"
        >
          {mode === "edit" ? "Update Quote" : "Submit Quote"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { SupplierQuoteFormValues, supplierQuoteSchema } from "@/validation/estimationSchema";
import { SupplierQuote } from "@/domain/estimations/estimationTypes";

interface SupplierQuoteFormProps {
  mode: "create" | "edit";
  defaultValues?: SupplierQuoteFormValues & { QuoteID?: number };
  itemId: number;
  quotes: SupplierQuote[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function SupplierQuoteForm({
  mode,
  defaultValues,
  itemId,
  quotes,
  onSuccess,
  onCancel,
}: SupplierQuoteFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierQuoteFormValues>({
    resolver: zodResolver(supplierQuoteSchema),
    defaultValues,
  });

  const onSubmit = async (data: SupplierQuoteFormValues) => {
    try {
      const isDuplicate =
        mode === "create" &&
        quotes.some((q: SupplierQuote) => q.SupplierID === data.SupplierID);

      if (isDuplicate) {
        toast.error("A quote from this supplier already exists.");
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
      const url =
        mode === "edit"
          ? `${baseUrl}/api/backend/estimation/quotes/${defaultValues?.QuoteID}`
          : `${baseUrl}/api/backend/estimation/quotes/create`;

      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ItemID: itemId,
        }),
      });

      // ✅ Handle backend duplicate error
      if (res.status === 409) {
        const data = await res.json();
        toast.error(data.message);
        return;
      }

      // ✅ Fallback generic error handler
      if (!res.ok) throw new Error("Save failed");
      
      onSuccess();
      if (mode === "create") reset();
    } catch (err) {
      console.error("Failed to save quote:", err);
      toast.error("Failed to save supplier quote.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label>Supplier ID</label>
          <input
            {...register("SupplierID", { valueAsNumber: true })}
            type="number"
            className="border p-2 w-full"
          />
          {errors.SupplierID && <p className="text-red-500">{errors.SupplierID.message}</p>}
        </div>
        <div>
          <label>Unit Cost</label>
          <input
            {...register("UnitCost", { valueAsNumber: true })}
            type="number"
            className="border p-2 w-full"
          />
          {errors.UnitCost && <p className="text-red-500">{errors.UnitCost.message}</p>}
        </div>
        <div>
          <label>Currency</label>
          <input
            {...register("Currency")}
            type="text"
            className="border p-2 w-full"
          />
          {errors.Currency && <p className="text-red-500">{errors.Currency.message}</p>}
        </div>
        <div>
          <label>Expected Delivery (Days)</label>
          <input
            {...register("ExpectedDeliveryDays", { valueAsNumber: true })}
            type="number"
            className="border p-2 w-full"
          />
          {errors.ExpectedDeliveryDays && <p className="text-red-500">{errors.ExpectedDeliveryDays.message}</p>}
        </div>
        <div className="col-span-2">
          <label>Notes</label>
          <textarea
            {...register("Notes")}
            className="border p-2 w-full"
          />
          {errors.Notes && <p className="text-red-500">{errors.Notes.message}</p>}
        </div>
      </div>

      <div className="flex justify-between">
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          {mode === "edit" ? "Update Quote" : "Add Supplier Quote"}
        </button>
        <button type="button" className="text-red-500" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

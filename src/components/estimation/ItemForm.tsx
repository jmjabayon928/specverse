// src/components/estimation/ItemForm.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "react-hot-toast";
import { itemSchema, ItemFormValues } from "@/validation/estimationSchema";
import { EstimationItem } from "@/domain/estimations/estimationTypes";

interface InventoryItemOption {
  itemCode: number;
  itemName: string;
  uom?: string;
}

interface ItemFormProps {
  mode: "create" | "edit";
  defaultValues?: ItemFormValues & { EItemID?: number };
  estimationId: number;
  packageId: number;
  items: EstimationItem[];
  onSuccess: () => void;
  onCancel: () => void;
  inventoryItems: InventoryItemOption[]; // ✅ NEW PROP
}

export default function ItemForm({
  mode,
  defaultValues,
  estimationId,
  packageId,
  items,
  onSuccess,
  onCancel,
  inventoryItems, // ✅ RECEIVED HERE
}: ItemFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues,
  });

  const onSubmit = async (data: ItemFormValues) => {
    try {
      const isDuplicate =
        mode === "create" &&
        items.some((item: EstimationItem) => item.ItemID === data.ItemID);

      if (isDuplicate) {
        toast.error("This item already exists in the package.");
        return;
      }

      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
      const url =
        mode === 'edit'
          ? `${baseUrl}/api/backend/estimation/items/${defaultValues?.EItemID}`
          : `${baseUrl}/api/backend/estimation/items/create`;

      const res = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          EstimationID: estimationId,
          PackageID: packageId,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        toast.error(data.message);
        return;
      }

      if (!res.ok) throw new Error('Save failed');

      onSuccess();
      if (mode === 'create') reset();
    } catch (err) {
      console.error('Failed to save item:', err);
      toast.error("Failed to save item.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Item</label>
        <select
          {...register("ItemID", { valueAsNumber: true })}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm"
        >
          <option value="">-- Select an Item --</option>
          {inventoryItems.map((item) => (
            <option key={item.itemCode} value={item.itemCode}>
              {item.itemName} {item.uom ? `(${item.uom})` : ""}
            </option>
          ))}
        </select>
        {errors.ItemID && <p className="text-red-500">{errors.ItemID.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          {...register("Description")}
          className="border p-2 w-full"
        />
        {errors.Description && <p className="text-red-500">{errors.Description.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Quantity</label>
        <input
          {...register("Quantity", { valueAsNumber: true })}
          type="number"
          className="border p-2 w-full"
        />
        {errors.Quantity && <p className="text-red-500">{errors.Quantity.message}</p>}
      </div>

      <div className="flex justify-between">
        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">
          {mode === "edit" ? "Update Item" : "Add Item"}
        </button>
        <button type="button" className="text-red-500" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

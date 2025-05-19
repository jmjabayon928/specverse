'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ItemFormProps } from '@/types/estimation';

// Define locally since InventoryItemOption is not exported
type InventoryItemOption = {
  ItemID: number;
  SheetNameEng: string;
};

type ItemFormValues = {
  ItemID: number;
  Quantity: number;
  Description?: string;
};

export default function ItemForm(props: ItemFormProps) {
  const {
    estimationId,
    packageId,
    mode = 'create',
    defaultValues,
    onSuccess,
    onCancel,
  } = props;

  const [itemOptions, setItemOptions] = useState<InventoryItemOption[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({
    defaultValues: {
      ItemID: defaultValues?.ItemID ?? 0,
      Quantity: defaultValues?.Quantity ?? 1,
      Description: defaultValues?.Description ?? '',
    },
  });

  // 🔄 Load item dropdown options
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch('/api/backend/inventory/item-options');
        const data = await res.json();
        setItemOptions(data);
      } catch (err) {
        console.error('Failed to load inventory items:', err);
      }
    };
    fetchItems();
  }, []);

  // ✅ Reset form when in edit mode after options load
  useEffect(() => {
    if (mode === 'edit' && defaultValues && itemOptions.length > 0) {
      reset({
        ItemID: defaultValues.ItemID,
        Quantity: defaultValues.Quantity,
        Description: defaultValues.Description ?? '',
      });
    }
  }, [defaultValues, itemOptions, mode, reset]);

  const onSubmit = async (data: ItemFormValues) => {
    try {
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

      if (!res.ok) throw new Error('Save failed');
      onSuccess();
      if (mode === 'create') reset(); // clear only for create
    } catch (err) {
      console.error('Failed to save item:', err);
      alert('Failed to save item.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Row 1: Select + Quantity */}
      <div className="flex gap-4">
        <div className="w-1/2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
          <select
            {...register("ItemID", { required: true })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">Select Item</option>
            {itemOptions.map((item) => (
              <option key={item.ItemID} value={item.ItemID}>
                {item.SheetNameEng}
              </option>
            ))}
          </select>
          {errors.ItemID && (
            <p className="text-red-500 text-xs mt-1">Item is required.</p>
          )}
        </div>

        <div className="w-1/2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            {...register("Quantity", {
              valueAsNumber: true,
              required: true,
              min: 1,
            })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          {errors.Quantity && (
            <p className="text-red-500 text-xs mt-1">Quantity is required and must be ≥ 1.</p>
          )}
        </div>
      </div>

      {/* Row 2: Description (full width) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register("Description")}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      {/* Row 3: Buttons */}
      <div className="flex justify-between items-center">
        <button
          type="submit"
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded shadow"
        >
          {mode === 'edit' ? 'Update Item' : 'Add Item'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-white bg-red-600 hover:bg-red-700 px-4 py-2 rounded shadow"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

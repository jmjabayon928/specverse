// src/components/inventory/InventoryForm.tsx
"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { InventoryFormValues } from "@/validation/inventorySchema";

type ReferenceItem = { id: number; name: string };

type InventoryFormProps = {
  values: InventoryFormValues;
  setValues: React.Dispatch<React.SetStateAction<InventoryFormValues>>;
  onSubmit: (data: InventoryFormValues) => void | Promise<void>;
  isSubmitting: boolean;
  categories: ReferenceItem[];
  suppliers: ReferenceItem[];
  manufacturers: ReferenceItem[];
};

export default function InventoryForm({
  values,
  setValues: _setValues, // ✅ renamed to avoid eslint warning
  onSubmit,
  isSubmitting,
  categories,
  suppliers,
  manufacturers,
}: InventoryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InventoryFormValues>({
    defaultValues: values,
  });

  // ✅ Prevent unused variable warning for _setValues
  useEffect(() => {
    void _setValues;
  }, [_setValues]);

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 bg-white p-6 rounded-md shadow-md border"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Item Code</label>
        <input
          type="text"
          {...register("itemCode", { required: true })}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
          placeholder="Enter Item Code"
        />
        {errors.itemCode && (
          <p className="text-red-600 text-xs mt-1">Item Code is required</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
        <input
          type="text"
          {...register("itemName", { required: true })}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
          placeholder="Enter Item Name"
        />
        {errors.itemName && (
          <p className="text-red-600 text-xs mt-1">Item Name is required</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select {...register("categoryId")} className="w-full border rounded-md px-4 py-2 text-sm">
          <option value="">-- Select Category --</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
        <select {...register("supplierId")} className="w-full border rounded-md px-4 py-2 text-sm">
          <option value="">-- Select Supplier --</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
        <select {...register("manufacturerId")} className="w-full border rounded-md px-4 py-2 text-sm">
          <option value="">-- Select Manufacturer --</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input
          type="text"
          {...register("location")}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
          placeholder="Enter location"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
        <input
          type="number"
          {...register("reorderLevel", { min: 0 })}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
          placeholder="Enter reorder level"
        />
        {errors.reorderLevel && (
          <p className="text-red-600 text-xs mt-1">Reorder level must be zero or greater</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Unit of Measure (UOM)</label>
        <input
          type="text"
          {...register("uom")}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
          placeholder="e.g. kg, pcs"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register("description")}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
          placeholder="Optional description"
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isSubmitting ? "Saving..." : "Save Inventory"}
        </button>
      </div>
    </form>
  );
}

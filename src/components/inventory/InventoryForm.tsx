"use client";

import React from "react";
import { useForm } from "react-hook-form";

type InventoryFormValues = {
  SheetID: number;
  WarehouseID: number;
  Quantity: number;
};

type SheetOption = {
  id: number;
  name: string;
};

type WarehouseOption = {
  id: number;
  name: string;
};

type InventoryFormProps = {
  onSubmit: (data: InventoryFormValues) => void;
  defaultValues?: InventoryFormValues;
  sheetOptions: SheetOption[];
  warehouses: WarehouseOption[];
};

export default function InventoryForm({
  onSubmit,
  defaultValues,
  sheetOptions,
  warehouses,
}: InventoryFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InventoryFormValues>({
    defaultValues,
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 bg-white p-6 rounded-md shadow-md border"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Datasheet
        </label>
        <select
          {...register("SheetID", { required: true })}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
        >
          <option value="">-- Select Sheet --</option>
          {sheetOptions.map((sheet) => (
            <option key={sheet.id} value={sheet.id}>
              {sheet.name}
            </option>
          ))}
        </select>
        {errors.SheetID && (
          <p className="text-red-600 text-xs mt-1">Sheet is required</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Select Warehouse
        </label>
        <select
          {...register("WarehouseID", { required: true })}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
        >
          <option value="">-- Select Warehouse --</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        {errors.WarehouseID && (
          <p className="text-red-600 text-xs mt-1">Warehouse is required</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Quantity
        </label>
        <input
          type="number"
          {...register("Quantity", { required: true, min: 1 })}
          className="w-full border rounded-md px-4 py-2 shadow-sm text-sm"
          placeholder="Enter quantity"
        />
        {errors.Quantity && (
          <p className="text-red-600 text-xs mt-1">Valid quantity required</p>
        )}
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition"
        >
          Save Inventory
        </button>
      </div>
    </form>
  );
}

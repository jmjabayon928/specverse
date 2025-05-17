"use client";
import { useForm } from "react-hook-form";
import { PackageFormValues } from "@/types/estimation";

export interface PackageFormProps {
  estimationId: number;
  onSuccess: () => void;
}

export default function PackageForm({ estimationId, onSuccess }: PackageFormProps) {
  const { register, handleSubmit, reset } = useForm<PackageFormValues>();

  const onSubmit = async (data: PackageFormValues) => {
    await fetch("/api/backend/estimation/packages/create", {
      method: "POST",
      body: JSON.stringify({ ...data, EstimationID: estimationId }),
      headers: { "Content-Type": "application/json" },
    });

    reset();
    alert("Package successfully added!");
    onSuccess();
  };

  return (
    <div>
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Create New Package</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Package Name <span className="text-red-500">*</span>
            </label>
            <input
                {...register("PackageName")}
                type="text"
                required
                className="w-full border rounded-md px-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. Pumping Station A"
            />
            </div>

            <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Sequence
            </label>
            <input
                {...register("Sequence")}
                type="number"
                className="w-full border rounded-md px-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. 1"
            />
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
            </label>
            <textarea
            {...register("Description")}
            className="w-full border rounded-md px-4 py-2 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="Optional package description..."
            rows={3}
            />
        </div>

        <div className="flex justify-end">
            <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-6 py-2 rounded-md shadow-sm"
            >
            Save Package
            </button>
        </div>
        </form>
    </div>
  );
}

"use client";
import { useForm } from "react-hook-form";
import type { ItemFormProps } from "@/types/estimation";

type ItemFormValues = {
    PartName: string;
    Quantity: number;
    UnitCost: number;
};

export default function ItemForm({ packageId, estimationId, onSuccess }: ItemFormProps) {
    const { register, handleSubmit, reset } = useForm<ItemFormValues>();

    const onSubmit = async (data: ItemFormValues) => {
        await fetch("/api/backend/estimation/items/create", {
            method: "POST",
            body: JSON.stringify({
                PackageID: packageId,
                EstimationID: estimationId, 
                PartName: data.PartName,
                Quantity: data.Quantity,
                UnitCost: data.UnitCost,
            }),
            headers: { "Content-Type": "application/json" },
        });

        reset(); 
        alert("Item successfully added!");
        onSuccess(); 
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 border p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">Add Item</h3>

            <input
                {...register("PartName", { required: true })}
                placeholder="Part Name"
                className="input w-full"
            />

            <input
                type="number"
                step="any"
                {...register("Quantity", { required: true, valueAsNumber: true })}
                placeholder="Quantity"
                className="input w-full"
            />

            <input
                type="number"
                step="any"
                {...register("UnitCost", { required: true, valueAsNumber: true })}
                placeholder="Unit Cost"
                className="input w-full"
            />

            <button type="submit" className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm text-sm">Add Item</button>
        </form>
    );
}

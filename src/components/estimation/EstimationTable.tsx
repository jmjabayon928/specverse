import React from "react";
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Estimation } from "@/types/estimation";

interface Props {
    estimations: Estimation[];
}

export default function EstimationTable({ estimations }: Props) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-md">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-2 text-left">ID</th>
                        <th className="px-4 py-2 text-left">Title</th>
                        <th className="px-4 py-2 text-left">Status</th>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Total Cost</th>
                        <th className="px-4 py-2 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {estimations.map(est => (
                        <tr key={est.EstimationID} className="border-b">
                            <td className="px-4 py-2">{est.EstimationID}</td>
                            <td className="px-4 py-2">{est.Title}</td>
                            <td className="px-4 py-2">{est.Status}</td>
                            <td className="px-4 py-2">{new Date(est.EstimationDate).toLocaleDateString()}</td>
                            <td className="px-4 py-2">${est.TotalMaterialCost?.toFixed(2)}</td>
                            <td className="px-4 py-2">
                                <div className="flex gap-3 text-gray-500">
                                    <button
                                        onClick={() => window.location.href = `/estimation/${est.EstimationID}`}
                                        title="View"
                                    >
                                        <EyeIcon className="h-5 w-5 hover:text-blue-600" />
                                    </button>
                                    <button title="Edit">
                                        <PencilIcon className="h-5 w-5 hover:text-amber-500" />
                                    </button>
                                    <button title="Delete">
                                        <TrashIcon className="h-5 w-5 hover:text-red-600" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

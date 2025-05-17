"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Estimation, EstimationPackage } from "@/types/estimation";
import PackageForm from "@/components/estimation/PackageForm";

export default function EstimationDetailPage() {
  const { id } = useParams();
  const estimationId = parseInt(id as string);
  const [estimation, setEstimation] = useState<Estimation | null>(null);
  const [packages, setPackages] = useState<EstimationPackage[]>([]);
  const [showForm, setShowForm] = useState(false); // ✅ controls visibility

  useEffect(() => {
    const fetchData = async () => {
      const res1 = await fetch(`/api/backend/estimation/${estimationId}`);
      setEstimation(await res1.json());

      const res2 = await fetch(`/api/backend/estimation/packages?estimationId=${estimationId}`);
      const packageData = await res2.json();
      setPackages(packageData);
    };

    if (!isNaN(estimationId)) {
      fetchData();
    }
  }, [estimationId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Estimation: {estimation?.Title ?? ""}
      </h1>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Packages</h2>
          <button
            onClick={() => setShowForm(prev => !prev)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {showForm ? "Cancel" : "+ Add Package"}
          </button>
        </div>

        <div className="overflow-x-auto shadow rounded-lg border border-gray-200">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-100 text-gray-700 text-sm uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Package Name</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map(pkg => (
                <tr key={pkg.PackageID} className="border-t text-sm text-gray-800">
                  <td className="px-4 py-2">{pkg.PackageName}</td>
                  <td className="px-4 py-2">{pkg.Description}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-3 text-gray-500">
                        <button
                            onClick={() => window.location.href = `/estimation/packages/${pkg.PackageID}`}
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
              {packages.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-center text-gray-400">
                    No packages found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showForm && (
          <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow border mt-6">
            <PackageForm
              estimationId={estimationId}
              onSuccess={async () => {
                const res = await fetch(`/api/backend/estimation/packages?estimationId=${estimationId}`);
                setPackages(await res.json());
                setShowForm(false); // hide form after successful add
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

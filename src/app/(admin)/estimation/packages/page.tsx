// src/app/(admin)/estimation/packages/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EstimationPackage } from "@/types/estimation";

export default function EstimationPackagesPage() {
  const [packages, setPackages] = useState<EstimationPackage[]>([]);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await fetch("/api/backend/estimation/packages/all", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await res.json();
        setPackages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching packages:", err);
      }
    };

    fetchPackages();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">All Estimation Packages</h1>

      <div className="overflow-x-auto shadow rounded-md border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Package Name</th>
              <th className="px-4 py-2 text-left">Estimation ID</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {packages.length > 0 ? (
              packages.map((pkg) => (
                <tr key={pkg.PackageID} className="border-t">
                  <td className="px-4 py-2">{pkg.PackageName}</td>
                  <td className="px-4 py-2">{pkg.EstimationID}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/estimation/packages/${pkg.PackageID}`}
                      className="text-blue-600 hover:underline"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-gray-500">
                  No packages found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

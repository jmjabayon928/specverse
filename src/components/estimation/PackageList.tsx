import React from "react";
import { EstimationPackage } from "@/types/estimation";

interface PackageListProps {
    packages: EstimationPackage[];
    onSelectPackage?: (packageId: number) => void;
}

export default function PackageList({ packages, onSelectPackage }: PackageListProps) {
    return (
        <div className="space-y-2">
            {packages.map((pkg) => (
                <div
                    key={pkg.PackageID}
                    className="cursor-pointer border p-4 rounded-md bg-white shadow-sm hover:bg-gray-50"
                    onClick={() => onSelectPackage?.(pkg.PackageID)}
                >
                    <h3 className="text-lg font-semibold">{pkg.PackageName}</h3>
                    <p className="text-sm text-gray-600">{pkg.Description}</p>
                    <div className="mt-2 text-sm text-gray-800">
                        <strong>Total Material Cost:</strong> ${pkg.TotalMaterialCost?.toFixed(2) ?? "0.00"}
                    </div>
                </div>
            ))}
        </div>
    );
}

"use client";
import Link from "next/link";
import { useEstimationData } from "@/hooks/useEstimationData";
import EstimationTable from "@/components/estimation/EstimationTable";

export default function EstimationDashboardPage() {
    const { data: estimations, loading } = useEstimationData();

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Project Estimation Dashboard</h1>

            <div className="flex justify-end">
                <Link
                    href="/estimation/create"
                    className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md shadow-sm transition"
                >
                    + Create Estimation
                </Link>
            </div>

            {loading ? (
                <div>Loading estimations...</div>
            ) : (
                <EstimationTable estimations={estimations} />
            )}
        </div>
    );
}

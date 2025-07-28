"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import EstimateVsActualTable from "./EstimateVsActualTable";

// Define the data structure
interface EstimationCostEntry {
  estimationId: number;
  projectName: string;
  materialCost: number;
  laborCost: number;
  vendorQuoteTotal: number;
}

export default function EstimationCostChart() {
  const [data, setData] = useState<EstimationCostEntry[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [selectedEstimationId, setSelectedEstimationId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/reports/estimation-cost");
        if (!res.ok) throw new Error(`Error: ${res.status}`);
        const result = await res.json();
        if (Array.isArray(result)) {
          setData(result);
        } else {
          console.error("Expected an array from API but got:", result);
          setData([]);
        }
      } catch (error) {
        console.error("Failed to fetch estimation cost data:", error);
        setData([]);
      }
    };

    fetchData();
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <XAxis dataKey="projectName" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="materialCost" stackId="a" fill="#8884d8" name="Material Cost" />
            <Bar dataKey="laborCost" stackId="a" fill="#82ca9d" name="Labor Cost" />
            <Bar dataKey="vendorQuoteTotal" stackId="a" fill="#ffc658" name="Vendor Quote" />
          </BarChart>
        </ResponsiveContainer>

        <div className="space-y-2 mt-4">
          {Array.isArray(data) && data.map((project, index) => {
            const key = project.estimationId
              ? `estimation-${project.estimationId}`
              : `fallback-${index}`;

            return (
              <div key={key}>
                <Dialog
                  open={openModal && selectedEstimationId === project.estimationId}
                  onOpenChange={setOpenModal}
                >
                  <DialogTrigger asChild>
                    <button
                      className="text-sm text-blue-600 underline"
                      onClick={() => {
                        setSelectedEstimationId(project.estimationId);
                        setOpenModal(true);
                      }}
                    >
                      View Estimate vs Actual for {project.projectName}
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl w-full">
                    <h3 className="text-lg font-semibold mb-4">
                      Estimate vs Actual – {project.projectName}
                    </h3>
                    {selectedEstimationId && (
                      <EstimateVsActualTable estimationId={selectedEstimationId} />
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

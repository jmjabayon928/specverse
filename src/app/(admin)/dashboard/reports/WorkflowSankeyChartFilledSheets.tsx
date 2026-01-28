// src/app/(admin)/dashboard/reports/WorkflowSankeyChartFilledSheets.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface SankeyNodeData {
  name: string;
}

interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
}

export default function WorkflowSankeyChartFilledSheets() {
  const [nodes, setNodes] = useState<SankeyNodeData[]>([]);
  const [links, setLinks] = useState<SankeyLinkData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSankeyData = async () => {
      try {
        const res = await fetch("/api/backend/reports/filledsheet-workflow-sankey", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const json = await res.json();

        if (!Array.isArray(json.nodes) || !Array.isArray(json.links)) {
          throw new Error("Invalid Sankey data format");
        }

        setNodes(json.nodes);
        setLinks(json.links);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Error fetching filled sheet workflow sankey data:", err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchSankeyData();
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">Filled Sheet Workflow Stream</h2>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading Sankey data...</p>
        ) : error ? (
          <p className="text-red-500 text-sm">Error: {error}</p>
        ) : nodes.length > 0 && links.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <Sankey
              data={{ nodes, links }}
              nodePadding={30}
              margin={{ top: 10, bottom: 10, left: 50, right: 50 }}
              node={{ style: { fill: "#0984e3" } }}
              link={{ stroke: "#0984e3" }}
            >
              <Tooltip />
            </Sankey>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted-foreground text-sm">No data available to display.</p>
        )}
      </CardContent>
    </Card>
  );
}

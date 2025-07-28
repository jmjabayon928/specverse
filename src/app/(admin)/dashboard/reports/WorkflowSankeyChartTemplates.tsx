// src/app/(admin)/dashboard/reports/WorkflowSankeyChartTemplates.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Sankey, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface SankeyNodeData {
  name: string;
  id: string; // Unique identifier required for key warnings
}

interface SankeyLinkData {
  source: number;
  target: number;
  value: number;
}

export default function WorkflowSankeyChartTemplates() {
  const [nodes, setNodes] = useState<SankeyNodeData[]>([]);
  const [links, setLinks] = useState<SankeyLinkData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSankeyData = async () => {
      try {
        const res = await fetch("/api/backend/reports/template-workflow-sankey");
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const json = await res.json();

        console.log("Sankey nodes", json.nodes); // Debugging nodes

        if (!Array.isArray(json.nodes) || !Array.isArray(json.links)) {
          throw new Error("Invalid Sankey data format");
        }

        // ✅ Add fallback and unique IDs to nodes
        const dedupedNodes: SankeyNodeData[] = json.nodes.map((node: { name?: string }, index: number) => {
          const name = node.name || `node-${index}`;
          return {
            name,
            id: `${name}-${index}`, // ensure unique identifier
          };
        });

        setNodes(dedupedNodes);
        setLinks(json.links);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("Error fetching template workflow sankey data:", err);
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
        <h2 className="text-lg font-semibold mb-4">Template Workflow Stream</h2>
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
              nodeId="id"
              node={{
                style: { fill: "#00b894" }, // or "#8884d8" for templates
              }}
              link={{ stroke: "#00b894" }}
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

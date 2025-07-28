// src/components/dashboard/DashboardClient.tsx
"use client";

import React from "react";
import type { UserSession } from "@/types/session";
import { Card, CardContent } from "@/components/ui/card";
import dynamic from "next/dynamic";

// Specific chart components
const DatasheetsByStatus = dynamic(() => import("@/components/dashboard/DatasheetsByStatus"), { ssr: false });
const TemplatesOverTimeChart = dynamic(() => import("@/components/dashboard/TemplatesOverTimeChart"), { ssr: false });
const PendingVerifications = dynamic(() => import("@/components/dashboard/PendingVerifications"), { ssr: false });
const ActiveUsersByRole = dynamic(() => import("@/components/dashboard/ActiveUsersByRole"), { ssr: false });
const InventoryStockLevels = dynamic(() => import("@/components/dashboard/InventoryStockLevels"), { ssr: false });
const EstimationTotalsByProject = dynamic(() => import("@/components/dashboard/EstimationTotalsByProject"), { ssr: false });

type Props = {
  user: UserSession;
};

export default function DashboardClient({ user }: Props) {
  const role = user.role;

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {(role === "Engineer" || role === "Admin") && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Datasheets by Status</h2>
            <DatasheetsByStatus />
          </CardContent>
        </Card>
      )}

      {(role === "Engineer" || role === "Supervisor" || role === "Admin") && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Templates Created Over Time</h2>
            <TemplatesOverTimeChart />
          </CardContent>
        </Card>
      )}

      {(role === "Supervisor" || role === "Admin") && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Pending Verifications</h2>
            <PendingVerifications />
          </CardContent>
        </Card>
      )}

      {role === "Admin" && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Active Users by Role</h2>
            <ActiveUsersByRole />
          </CardContent>
        </Card>
      )}

      {(role === "Engineer" || role === "Supervisor" || role === "Admin") && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Inventory Stock Levels</h2>
            <InventoryStockLevels />
          </CardContent>
        </Card>
      )}

      {(role === "Engineer" || role === "Supervisor" || role === "Admin") && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Estimation Totals by Project</h2>
            <EstimationTotalsByProject />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

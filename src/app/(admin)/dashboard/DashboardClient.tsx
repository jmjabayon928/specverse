// src/components/dashboard/DashboardClient.tsx
"use client";

import React from "react";
import type { UserSession } from "@/domain/auth/sessionTypes";
import { PERMISSIONS } from "@/constants/permissions";
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

function hasPermission(permissions: string[] | undefined, key: string): boolean {
  return Array.isArray(permissions) && permissions.includes(key);
}

export default function DashboardClient({ user }: Props) {
  const role = user.role;
  const permissions = user.permissions ?? [];

  const showDatasheets = hasPermission(permissions, PERMISSIONS.DATASHEET_VIEW);
  // Templates: no TEMPLATE* key in constants; canonical key for templates is DATASHEET_VIEW per constants.
  const showTemplates = hasPermission(permissions, PERMISSIONS.DATASHEET_VIEW);
  // Pending verifications: DATASHEET_VERIFY is the existing "can verify datasheets" permission.
  const showVerifications = hasPermission(permissions, PERMISSIONS.DATASHEET_VERIFY);
  const showActiveUsers = role === "Admin" || role?.toLowerCase() === "admin";
  const showInventory = hasPermission(permissions, PERMISSIONS.INVENTORY_VIEW);
  const showEstimation = hasPermission(permissions, PERMISSIONS.ESTIMATION_VIEW);

  const hasAnyWidget = showDatasheets || showTemplates || showVerifications || showActiveUsers || showInventory || showEstimation;

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {showDatasheets && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Datasheets by Status</h2>
            <DatasheetsByStatus />
          </CardContent>
        </Card>
      )}

      {showTemplates && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Templates Created Over Time</h2>
            <TemplatesOverTimeChart />
          </CardContent>
        </Card>
      )}

      {showVerifications && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Pending Verifications</h2>
            <PendingVerifications />
          </CardContent>
        </Card>
      )}

      {showActiveUsers && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Active Users by Role</h2>
            <ActiveUsersByRole />
          </CardContent>
        </Card>
      )}

      {showInventory && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Inventory Stock Levels</h2>
            <InventoryStockLevels />
          </CardContent>
        </Card>
      )}

      {showEstimation && (
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Estimation Totals by Project</h2>
            <EstimationTotalsByProject />
          </CardContent>
        </Card>
      )}

      {!hasAnyWidget && (
        <Card>
          <CardContent>
            <p className="text-muted-foreground">No dashboard widgets available for your current permissions.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

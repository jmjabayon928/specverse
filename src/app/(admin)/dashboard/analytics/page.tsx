// src/app/(admin)/dashboard/analytics/page.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import SecurePage from "@/components/security/SecurePage";
import { Card, CardContent } from "@/components/ui/card";

// Dynamic import of analytic charts
const DatasheetLifecycleChart = dynamic(() => import("./DatasheetLifecycleChart"), { ssr: false });
const VerificationBottlenecksChart = dynamic(() => import("./VerificationBottlenecksChart"), { ssr: false });
const TemplateUsageChart = dynamic(() => import("./TemplateUsageChart"), { ssr: false });
const TeamPerformanceRadarChart = dynamic(() => import("./TeamPerformanceRadarChart"), { ssr: false });
const FieldCompletionHeatmap = dynamic(() => import("./FieldCompletionHeatmap"), { ssr: false });

export default function AnalyticsPage() {
  return (
    <SecurePage requiredPermission="DASHBOARD_VIEW">
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Datasheet Lifecycle Duration</h2>
            <DatasheetLifecycleChart />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Verification Bottlenecks</h2>
            <VerificationBottlenecksChart />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Monthly Template Usage</h2>
            <TemplateUsageChart />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Team Performance Overview</h2>
            <TeamPerformanceRadarChart />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 xl:col-span-3">
          <CardContent>
            <h2 className="font-bold text-lg mb-2">Field Completion Trends</h2>
            <FieldCompletionHeatmap />
          </CardContent>
        </Card>
      </div>
    </SecurePage>
  );
}

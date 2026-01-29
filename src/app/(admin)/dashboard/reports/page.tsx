// src/app/(admin)/dashboard/reports/page.tsx

import React from "react";
import { Separator } from "@/components/ui/separator";

// Placeholder chart components (replace with actual implementations)
import EstimationCostChart from "./EstimationCostChart";
import InventoryForecastChart from "./InventoryForecastChart";
import InventoryContributionChart from "./InventoryContributionChart";
import RejectedTemplatesChart from "./RejectedTemplatesChart";
import RejectedFilledSheetsChart from "./RejectedFilledSheetsChart";
import WorkflowSankeyChartTemplates from "./WorkflowSankeyChartTemplates";
import WorkflowSankeyChartFilledSheets from "./WorkflowSankeyChartFilledSheets";
import SupplierComparisonChart from "./SupplierComparisonChart";
import SecurePage from '@/components/security/SecurePage';

export default function ReportsPage() {
  return (
    <SecurePage requiredPermission="DASHBOARD_VIEW">
      <div className="p-6 space-y-10">
        <h1 className="text-2xl font-bold">📑 Reports Dashboard</h1>

        {/* 1. Estimation Cost Breakdown */}
        <section>
          <h2 className="text-lg font-semibold">🧮 Estimation Cost Breakdown by Project</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Split by materials, labor, vendor quotes
          </p>
          <EstimationCostChart />
        </section>
        <Separator />

        {/* 2. Inventory Usage Forecast */}
        <section>
          <h2 className="text-lg font-semibold">📈 Inventory Usage Forecast</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Predict depletion trends and restock periods
          </p>
          <InventoryForecastChart />
        </section>
        <Separator />

        {/* 3. Inventory Category Contribution */}
        <section>
          <h2 className="text-lg font-semibold">📦 Inventory Category Contribution</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Visualize which items/categories dominate stock value
          </p>
          <InventoryContributionChart />
        </section>
        <Separator />

        {/* 4. Rejected Templates Over Time */}
        <section>
          <h2 className="text-lg font-semibold">📉 Rejected Templates Over Time</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Monitor QA/QC issues for templates for process improvement
          </p>
          <RejectedTemplatesChart />
        </section>
        <Separator />

        {/* 5. Rejected Filled Sheets Over Time */}
        <section>
          <h2 className="text-lg font-semibold">📉 Rejected DataSheets Over Time</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Monitor QA/QC issues for filled sheets for process improvement
          </p>
          <RejectedFilledSheetsChart />
        </section>
        <Separator />

        {/* 6. Workflow Stream (Sankey) - Templates */}
        <section>
          <h2 className="text-lg font-semibold">🔄 Workflow Stream for Templates</h2>
          <p className="text-sm text-muted-foreground mb-2">
            From draft → verification → approval → export
          </p>
          <WorkflowSankeyChartTemplates />
        </section>
        <Separator />
        
        {/* 7. Workflow Stream (Sankey) - Filled Sheets */}
        <section>
          <h2 className="text-lg font-semibold">🔄 Workflow Stream for DataSheets</h2>
          <p className="text-sm text-muted-foreground mb-2">
            From draft → verification → approval → export
          </p>
          <WorkflowSankeyChartFilledSheets />
        </section>
        <Separator />

        {/* 8. Supplier Comparison */}
        <section>
          <h2 className="text-lg font-semibold">📊 Supplier Comparison by Item</h2>
          <p className="text-sm text-muted-foreground mb-2">
            Compare supplier quotes side-by-side for each item
          </p>
          <SupplierComparisonChart />
        </section>
      </div>
    </SecurePage>
  );
}

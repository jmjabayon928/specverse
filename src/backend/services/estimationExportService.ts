// src/backend/services/estimationExportService.ts
import { generatePdf } from "html-pdf-node";
import ExcelJS from "exceljs";
import { getEstimationById } from "../database/estimationQueries";
import { getFilteredEstimationsWithPagination } from "../database/estimationQueries";
import { getPackagesByEstimationId, getPackageById } from "../database/estimationPackageQueries";
import { getItemsByPackageId } from "../database/estimationItemQueries";
import { getQuotesByItemId } from "../database/estimationQuoteQueries";
import { EstimationItem, SupplierQuote } from "@/types/estimation";

export async function generateFilteredEstimationPDF(
  statuses: string[],
  clients: number[],
  projects: number[],
  search: string
): Promise<Buffer> {
  const { estimations } = await getFilteredEstimationsWithPagination(
    statuses, clients, projects, search, 1, 1000 // fetch up to 1000 results
  );

  let html = `
    <html><head><style>
      body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; }
      h1 { color: #1a3c66; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px; }
      th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
      th { background: #f0f0f0; }
    </style></head><body>
    <h1>Filtered Estimations</h1>
    <p><strong>Filters Applied:</strong></p>
    <ul>
      <li><strong>Status:</strong> ${statuses.length ? statuses.join(", ") : "All"}</li>
      <li><strong>Clients:</strong> ${clients.length ? clients.join(", ") : "All"}</li>
      <li><strong>Projects:</strong> ${projects.length ? projects.join(", ") : "All"}</li>
      <li><strong>Search:</strong> ${search || "None"}</li>
    </ul>

    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Title</th>
          <th>Description</th>
          <th>Status</th>
          <th>Client</th>
          <th>Project</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const est of estimations) {
    html += `
      <tr>
        <td>${est.EstimationID}</td>
        <td>${est.Title}</td>
        <td>${est.Description || "-"}</td>
        <td>${est.Status}</td>
        <td>${est.ClientName || "-"}</td>
        <td>${est.ProjectName || "-"}</td>
        <td>${est.CreatedAt ? new Date(est.CreatedAt).toLocaleDateString() : "-"}</td>
      </tr>
    `;
  }

  html += `</tbody></table></body></html>`;

  return await generatePdf({ content: html }, { format: "A4" }) as unknown as Buffer;
}

export async function generateEstimationPDF(estimationId: number): Promise<Buffer> {
  const estimation = await getEstimationById(estimationId);
  if (!estimation) throw new Error("Estimation not found");

  const packages = await getPackagesByEstimationId(estimationId);

  const allItems: Record<number, EstimationItem[]> = {};
  const allQuotes: Record<number, SupplierQuote[]> = {};

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID);
    allItems[pkg.PackageID] = items;

    for (const item of items) {
      const quotes = await getQuotesByItemId(item.EItemID);
      allQuotes[item.EItemID] = quotes;
    }
  }

  let htmlContent = `
    <html><head><style>
      body { font-family: Arial; font-size: 11px; color: #333; padding: 20px; }
      h1, h2, h3 { color: #1a3c66; }
      fieldset { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
      legend { font-weight: bold; font-size: 14px; padding: 0 6px; color: #1a3c66; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 10px; }
      td, th { border: 1px solid #ccc; padding: 6px; text-align: left; }
      .items-table th { background-color: #a3a3c2; }
      .quote-selected { background-color: #d1e7dd; font-weight: bold; }
      .quote-table th { background-color: #cecece; }
    </style></head><body>

    <h1>Estimation Report</h1>
    <h2>${estimation.Title}</h2>

    <table>
      <tr><td>Estimation ID</td><td><strong>${estimation.EstimationID}</strong></td><td>Title</td><td><strong>${estimation.Title}</strong></td></tr>
      <tr><td>Client Name</td><td><strong>${estimation.ClientName || '-'}</strong></td><td>Description</td><td><strong>${estimation.Description || '-'}</strong></td></tr>
      <tr><td>Project Name</td><td><strong>${estimation.ProjectName || '-'}</strong></td><td>Total Material Cost</td><td><strong>$${estimation.TotalMaterialCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Currency</td><td><strong>${estimation.CurrencyCode || '-'}</strong></td><td>Status</td><td><strong>${estimation.Status}</strong></td></tr>
      <tr><td>Created By</td><td><strong>${estimation.CreatedByName || '-'}</strong></td><td>Date Created</td><td><strong>${new Date(estimation.CreatedAt).toLocaleDateString()}</strong></td></tr>
      <tr><td>Verified By</td><td><strong>${estimation.VerifiedByName || '-'}</strong></td><td>Date Verified</td><td><strong>${new Date(estimation.VerifiedAt).toLocaleDateString()}</strong></td></tr>
      <tr><td>Approved By</td><td><strong>${estimation.ApprovedByName || '-'}</strong></td><td>Date Approved</td><td><strong>${new Date(estimation.ApprovedAt).toLocaleDateString()}</strong></td></tr>
    </table>
  `;

  for (const pkg of packages) {
    htmlContent += `<fieldset>
      <legend>Package: ${pkg.PackageName}</legend>

      <table>
        <tr><td>Package Name</td><td><strong>${pkg.PackageName}</strong></td><td>Total Material Cost</td><td><strong>$${pkg.TotalMaterialCost?.toFixed(2) || '0.00'}</strong></td></tr>
        <tr><td>Description</td><td><strong>${pkg.Description || '-'}</strong></td><td>Total Labor Cost</td><td><strong>$${pkg.TotalLaborCost?.toFixed(2) || '0.00'}</strong></td></tr>
        <tr><td>Sequence</td><td><strong>${pkg.Sequence ?? '-'}</strong></td><td>Total Duration (days)</td><td><strong>${pkg.TotalDurationDays ?? '-'}</strong></td></tr>
        <tr><td>Created By</td><td><strong>${pkg.CreatedByName || '-'}</strong></td><td>Date Created</td><td><strong>${pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : '-'}</strong></td></tr>
        <tr><td>Modified By</td><td><strong>${pkg.ModifiedByName || '-'}</strong></td><td>Date Modified</td><td><strong>${pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : '-'}</strong></td></tr>
      </table>

      <fieldset>
        <legend>Items</legend>
        <table class="items-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Qty</th>
              <th>Description</th>
              <th>Created By</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
    `;

    for (const item of allItems[pkg.PackageID] || []) {
      htmlContent += `
        <tr>
          <td>${item.ItemName || item.ItemID}</td>
          <td>${item.Quantity}</td>
          <td>${item.Description || "-"}</td>
          <td>${item.CreatedByName}</td>
          <td>${item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString() : '-'}</td>
        </tr>
      `;

      const quotes = allQuotes[item.EItemID] || [];
      if (quotes.length > 0) {
        htmlContent += `
        <tr><td colspan="5">
          <table class="quote-table" style="font-size: 10px;">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Cost</th>
                <th>Currency</th>
                <th>Delivery Days</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
        `;

        for (const quote of quotes) {
          htmlContent += `
            <tr class="${quote.IsSelected ? "quote-selected" : ""}">
              <td>${quote.SupplierName}</td>
              <td>$${quote.QuotedUnitCost?.toFixed(2)}</td>
              <td>${quote.CurrencyCode}</td>
              <td>${quote.ExpectedDeliveryDays ?? "-"}</td>
              <td>${quote.Notes || "-"}</td>
            </tr>
          `;
        }

        htmlContent += `</tbody></table></td></tr>`;
      }
    }

    htmlContent += `</tbody></table></fieldset></fieldset>`;
  }

  htmlContent += `</body></html>`;

  return await generatePdf({ content: htmlContent }, { format: "A4" }) as unknown as Buffer;
}

export async function generateEstimationSummaryPDF(estimationId: number): Promise<Buffer> {
  const estimation = await getEstimationById(estimationId);
  if (!estimation) throw new Error("Estimation not found");

  const packages = await getPackagesByEstimationId(estimationId);

  const allItems: Record<number, number> = {};
  const allQuotes: Record<number, number> = {};

  let totalItems = 0;
  let totalQuotes = 0;
  let totalMaterial = 0;
  let totalLabor = 0;
  let totalDuration = 0;

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID);
    const itemCount = items.length;
    allItems[pkg.PackageID] = itemCount;
    totalItems += itemCount;

    let quoteCount = 0;
    for (const item of items) {
      const quotes = await getQuotesByItemId(item.EItemID);
      quoteCount += quotes.length;
    }
    allQuotes[pkg.PackageID] = quoteCount;
    totalQuotes += quoteCount;

    totalMaterial += pkg.TotalMaterialCost || 0;
    totalLabor += pkg.TotalLaborCost || 0;
    totalDuration += pkg.TotalDurationDays || 0;
  }

  let htmlContent = `
    <html><head><style>
      body { font-family: Arial; font-size: 11px; color: #333; padding: 20px; }
      h1, h2, h3 { color: #1a3c66; }
      fieldset { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; border-radius: 6px; }
      legend { font-weight: bold; font-size: 14px; padding: 0 6px; color: #1a3c66; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 10px; }
      td, th { border: 1px solid #ccc; padding: 6px; text-align: left; }
      .summary-table th { background-color: #a3a3c2; }
    </style></head><body>

    <h1>Estimation Summary</h1>
    <h2>${estimation.Title}</h2>

    <table>
      <tr><td>Estimation ID</td><td><strong>${estimation.EstimationID}</strong></td><td>Title</td><td><strong>${estimation.Title}</strong></td></tr>
      <tr><td>Client Name</td><td><strong>${estimation.ClientName || '-'}</strong></td><td>Description</td><td><strong>${estimation.Description || '-'}</strong></td></tr>
      <tr><td>Project Name</td><td><strong>${estimation.ProjectName || '-'}</strong></td><td>Total Material Cost</td><td><strong>$${estimation.TotalMaterialCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Currency</td><td><strong>${estimation.CurrencyCode || '-'}</strong></td><td>Status</td><td><strong>${estimation.Status}</strong></td></tr>
      <tr><td>Created By</td><td><strong>${estimation.CreatedByName || '-'}</strong></td><td>Date Created</td><td><strong>${new Date(estimation.CreatedAt).toLocaleDateString()}</strong></td></tr>
      <tr><td>Verified By</td><td><strong>${estimation.VerifiedByName || '-'}</strong></td><td>Date Verified</td><td><strong>${new Date(estimation.VerifiedAt).toLocaleDateString()}</strong></td></tr>
      <tr><td>Approved By</td><td><strong>${estimation.ApprovedByName || '-'}</strong></td><td>Date Approved</td><td><strong>${new Date(estimation.ApprovedAt).toLocaleDateString()}</strong></td></tr>
    </table>

    <fieldset>
      <legend>Packages Overview</legend>
      <table class="summary-table">
        <thead>
          <tr>
            <th>Package Name</th>
            <th>Item Count</th>
            <th>Quote Count</th>
            <th>Total Material Cost</th>
            <th>Total Labor Cost</th>
            <th>Total Duration (days)</th>
            <th>Created By</th>
            <th>Date Created</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const pkg of packages) {
    htmlContent += `
      <tr>
        <td>${pkg.PackageName}</td>
        <td>${allItems[pkg.PackageID] || 0}</td>
        <td>${allQuotes[pkg.PackageID] || 0}</td>
        <td>$${pkg.TotalMaterialCost?.toFixed(2) || "0.00"}</td>
        <td>$${pkg.TotalLaborCost?.toFixed(2) || "0.00"}</td>
        <td>${pkg.TotalDurationDays ?? "-"}</td>
        <td>${pkg.CreatedByName || "-"}</td>
        <td>${pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : "-"}</td>
      </tr>
    `;
  }

  htmlContent += `
      <tr style="font-weight: bold; background-color: #f0f0f0;">
        <td>Total</td>
        <td>${totalItems}</td>
        <td>${totalQuotes}</td>
        <td>$${totalMaterial.toFixed(2)}</td>
        <td>$${totalLabor.toFixed(2)}</td>
        <td>${totalDuration}</td>
        <td colspan="2"></td>
      </tr>
        </tbody>
      </table>
    </fieldset>
  </body></html>
  `;

  return await generatePdf({ content: htmlContent }, { format: "A4" }) as unknown as Buffer;
}

export async function generatePackageProcurementPDF(packageId: number): Promise<Buffer> {
  const pkg = await getPackageById(packageId);
  if (!pkg) throw new Error("Package not found");

  const estimation = await getEstimationById(pkg.EstimationID);
  if (!estimation) throw new Error("Estimation not found for this package");

  const items = await getItemsByPackageId(pkg.PackageID);
  const allQuotes: Record<number, SupplierQuote[]> = {};

  for (const item of items) {
    const quotes = await getQuotesByItemId(item.EItemID);
    allQuotes[item.EItemID] = quotes;
  }

  let htmlContent = `
    <html><head><style>
      body { font-family: Arial; font-size: 11px; color: #333; padding: 20px; }
      h1, h2, h3 { color: #1a3c66; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 10px; }
      td, th { border: 1px solid #ccc; padding: 6px; text-align: left; }
      .items-table th { background-color: #a3a3c2; }
      .quote-selected { background-color: #d1e7dd; font-weight: bold; }
      .quote-table th { background-color: #cecece; }
    </style></head><body>

    <h1>Package Procurement Sheet</h1>

    <h2>Estimation Details</h2>
    <table>
      <tr><td>Estimation ID</td><td><strong>${estimation.EstimationID}</strong></td><td>Title</td><td><strong>${estimation.Title}</strong></td></tr>
      <tr><td>Client Name</td><td><strong>${estimation.ClientName || '-'}</strong></td><td>Description</td><td><strong>${estimation.Description || '-'}</strong></td></tr>
      <tr><td>Project Name</td><td><strong>${estimation.ProjectName || '-'}</strong></td><td>Total Material Cost</td><td><strong>$${estimation.TotalMaterialCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Currency</td><td><strong>${estimation.CurrencyCode || '-'}</strong></td><td>Status</td><td><strong>${estimation.Status}</strong></td></tr>
      <tr><td>Created By</td><td><strong>${estimation.CreatedByName || '-'}</strong></td><td>Date Created</td><td><strong>${estimation.CreatedAt ? new Date(estimation.CreatedAt).toLocaleDateString() : '-'}</strong></td></tr>
      <tr><td>Verified By</td><td><strong>${estimation.VerifiedByName || '-'}</strong></td><td>Date Verified</td><td><strong>${estimation.VerifiedAt ? new Date(estimation.VerifiedAt).toLocaleDateString() : '-'}</strong></td></tr>
      <tr><td>Approved By</td><td><strong>${estimation.ApprovedByName || '-'}</strong></td><td>Date Approved</td><td><strong>${estimation.ApprovedAt ? new Date(estimation.ApprovedAt).toLocaleDateString() : '-'}</strong></td></tr>
    </table>

    <h2>${pkg.PackageName || "Unnamed Package"}</h2>

    <table>
      <tr><td>Package Name</td><td><strong>${pkg.PackageName}</strong></td><td>Total Material Cost</td><td><strong>$${pkg.TotalMaterialCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Description</td><td><strong>${pkg.Description || '-'}</strong></td><td>Total Labor Cost</td><td><strong>$${pkg.TotalLaborCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Sequence</td><td><strong>${pkg.Sequence ?? '-'}</strong></td><td>Total Duration (days)</td><td><strong>${pkg.TotalDurationDays ?? '-'}</strong></td></tr>
      <tr><td>Created By</td><td><strong>${pkg.CreatedByName || '-'}</strong></td><td>Date Created</td><td><strong>${pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : '-'}</strong></td></tr>
      <tr><td>Modified By</td><td><strong>${pkg.ModifiedByName || '-'}</strong></td><td>Date Modified</td><td><strong>${pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : '-'}</strong></td></tr>
    </table>

    <h3>Items and Selected Quotes</h3>
    <table class="items-table">
      <thead>
        <tr>
          <th>Item Name</th>
          <th>Quantity</th>
          <th>Description</th>
          <th>Selected Supplier</th>
          <th>Unit Cost</th>
          <th>Currency</th>
          <th>Delivery Days</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const item of items) {
    const selectedQuote = (allQuotes[item.EItemID] || []).find(q => q.IsSelected);
    htmlContent += `
      <tr>
        <td>${item.ItemName || item.ItemID}</td>
        <td>${item.Quantity}</td>
        <td>${item.Description || '-'}</td>
        <td>${selectedQuote?.SupplierName || '-'}</td>
        <td>${selectedQuote ? `$${selectedQuote.QuotedUnitCost?.toFixed(2)}` : '-'}</td>
        <td>${selectedQuote?.CurrencyCode || '-'}</td>
        <td>${selectedQuote?.ExpectedDeliveryDays ?? '-'}</td>
      </tr>
    `;
  }

  htmlContent += `</tbody></table></body></html>`;

  return await generatePdf({ content: htmlContent }, { format: "A4" }) as unknown as Buffer;
}

export async function generateEstimationProcurementPDF(estimationId: number): Promise<Buffer> {
  const estimation = await getEstimationById(estimationId);
  if (!estimation) throw new Error("Estimation not found");

  const packages = await getPackagesByEstimationId(estimationId);
  const allItems: Record<number, EstimationItem[]> = {};
  const allQuotes: Record<number, SupplierQuote[]> = {};

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID);
    allItems[pkg.PackageID] = items;
    for (const item of items) {
      const quotes = await getQuotesByItemId(item.EItemID);
      allQuotes[item.EItemID] = quotes;
    }
  }

  let htmlContent = `
    <html><head><style>
      body { font-family: Arial; font-size: 11px; color: #333; padding: 20px; }
      h1, h2, h3 { color: #1a3c66; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 12px; font-size: 10px; }
      td, th { border: 1px solid #ccc; padding: 6px; text-align: left; }
      .items-table th { background-color: #a3a3c2; }
      .quote-selected { background-color: #d1e7dd; font-weight: bold; }
      .quote-table th { background-color: #cecece; }
    </style></head><body>

    <h1>Estimation Procurement Sheet</h1>
    <h2>${estimation.Title}</h2>
    <table>
      <tr><td>Estimation ID</td><td><strong>${estimation.EstimationID}</strong></td><td>Title</td><td><strong>${estimation.Title}</strong></td></tr>
      <tr><td>Client Name</td><td><strong>${estimation.ClientName || '-'}</strong></td><td>Description</td><td><strong>${estimation.Description || '-'}</strong></td></tr>
      <tr><td>Project Name</td><td><strong>${estimation.ProjectName || '-'}</strong></td><td>Total Material Cost</td><td><strong>$${estimation.TotalMaterialCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Currency</td><td><strong>${estimation.CurrencyCode || '-'}</strong></td><td>Status</td><td><strong>${estimation.Status}</strong></td></tr>
      <tr><td>Created By</td><td><strong>${estimation.CreatedByName || '-'}</strong></td><td>Date Created</td><td><strong>${estimation.CreatedAt ? new Date(estimation.CreatedAt).toLocaleDateString() : '-'}</strong></td></tr>
      <tr><td>Verified By</td><td><strong>${estimation.VerifiedByName || '-'}</strong></td><td>Date Verified</td><td><strong>${estimation.VerifiedAt ? new Date(estimation.VerifiedAt).toLocaleDateString() : '-'}</strong></td></tr>
      <tr><td>Approved By</td><td><strong>${estimation.ApprovedByName || '-'}</strong></td><td>Date Approved</td><td><strong>${estimation.ApprovedAt ? new Date(estimation.ApprovedAt).toLocaleDateString() : '-'}</strong></td></tr>
    </table>
  `;

  for (const pkg of packages) {
    htmlContent += `
    <h2>${pkg.PackageName || 'Unnamed Package'}</h2>
    <table>
      <tr><td>Package Name</td><td><strong>${pkg.PackageName}</strong></td><td>Total Material Cost</td><td><strong>$${pkg.TotalMaterialCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Description</td><td><strong>${pkg.Description || '-'}</strong></td><td>Total Labor Cost</td><td><strong>$${pkg.TotalLaborCost?.toFixed(2) || '0.00'}</strong></td></tr>
      <tr><td>Sequence</td><td><strong>${pkg.Sequence ?? '-'}</strong></td><td>Total Duration (days)</td><td><strong>${pkg.TotalDurationDays ?? '-'}</strong></td></tr>
      <tr><td>Created By</td><td><strong>${pkg.CreatedByName || '-'}</strong></td><td>Date Created</td><td><strong>${pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : '-'}</strong></td></tr>
      <tr><td>Modified By</td><td><strong>${pkg.ModifiedByName || '-'}</strong></td><td>Date Modified</td><td><strong>${pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : '-'}</strong></td></tr>
    </table>

    <h3>Items and Selected Quotes</h3>
    <table class="items-table">
      <thead>
        <tr>
          <th>Item Name</th>
          <th>Quantity</th>
          <th>Description</th>
          <th>Selected Supplier</th>
          <th>Unit Cost</th>
          <th>Currency</th>
          <th>Delivery Days</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (const item of allItems[pkg.PackageID] || []) {
      const selectedQuote = (allQuotes[item.EItemID] || []).find(q => q.IsSelected);
      htmlContent += `
        <tr>
          <td>${item.ItemName || item.ItemID}</td>
          <td>${item.Quantity}</td>
          <td>${item.Description || '-'}</td>
          <td>${selectedQuote?.SupplierName || '-'}</td>
          <td>${selectedQuote ? `$${selectedQuote.QuotedUnitCost?.toFixed(2)}` : '-'}</td>
          <td>${selectedQuote?.CurrencyCode || '-'}</td>
          <td>${selectedQuote?.ExpectedDeliveryDays ?? '-'}</td>
        </tr>
      `;
    }

    htmlContent += `</tbody></table>`;
  }

  htmlContent += `</body></html>`;
  return await generatePdf({ content: htmlContent }, { format: "A4" }) as unknown as Buffer;
}

export async function generateEstimationExcel(estimationId: number): Promise<Uint8Array> {
  const estimation = await getEstimationById(estimationId);
  if (!estimation) throw new Error("Estimation not found");

  const packages = await getPackagesByEstimationId(estimationId);
  const allItems: Record<number, EstimationItem[]> = {};
  const allQuotes: Record<number, SupplierQuote[]> = {};

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID);
    allItems[pkg.PackageID] = items;
    for (const item of items) {
      const quotes = await getQuotesByItemId(item.EItemID);
      allQuotes[item.EItemID] = quotes;
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Estimation");
  sheet.columns = [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 50 },
  ];

  // Estimation details
  const estDetails = [
    ["Estimation ID", estimation.EstimationID],
    ["Title", estimation.Title],
    ["Client Name", estimation.ClientName || "-"],
    ["Description", estimation.Description || "-"],
    ["Project Name", estimation.ProjectName || "-"],
    ["Total Material Cost", `$${estimation.TotalMaterialCost?.toFixed(2) || "0.00"}`],
    ["Currency", estimation.CurrencyCode || "-"],
    ["Status", estimation.Status],
    ["Created By", estimation.CreatedByName || "-"],
    ["Date Created", estimation.CreatedAt ? new Date(estimation.CreatedAt).toLocaleDateString() : "-"],
    ["Verified By", estimation.VerifiedByName || "-"],
    ["Date Verified", estimation.VerifiedAt ? new Date(estimation.VerifiedAt).toLocaleDateString() : "-"],
    ["Approved By", estimation.ApprovedByName || "-"],
    ["Date Approved", estimation.ApprovedAt ? new Date(estimation.ApprovedAt).toLocaleDateString() : "-"],
  ];
  estDetails.forEach(([field, value]) => sheet.addRow({ field, value }));
  sheet.addRow([]);

  // For each package
  for (const pkg of packages) {
    sheet.addRow([`Package: ${pkg.PackageName}`]);
    const pkgDetails = [
      ["Package Name", pkg.PackageName],
      ["Description", pkg.Description || "-"],
      ["Total Material Cost", `$${pkg.TotalMaterialCost?.toFixed(2) || "0.00"}`],
      ["Total Labor Cost", `$${pkg.TotalLaborCost?.toFixed(2) || "0.00"}`],
      ["Total Duration Days", pkg.TotalDurationDays ?? "-"],
      ["Sequence", pkg.Sequence ?? "-"],
      ["Created By", pkg.CreatedByName || "-"],
      ["Created At", pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : "-"],
      ["Modified By", pkg.ModifiedByName || "-"],
      ["Modified At", pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : "-"],
    ];
    pkgDetails.forEach(([field, value]) => sheet.addRow({ field, value }));

    sheet.addRow([]);
    sheet.addRow({ field: "Item Name", value: "Quantity / Description / Selected Supplier / Cost / Currency / Delivery Days" });

    for (const item of allItems[pkg.PackageID] || []) {
      const selectedQuote = (allQuotes[item.EItemID] || []).find(q => q.IsSelected);
      const info = `${item.Quantity} / ${item.Description || "-"} / ${selectedQuote?.SupplierName || "-"} / $${selectedQuote?.QuotedUnitCost?.toFixed(2) || "-"} / ${selectedQuote?.CurrencyCode || "-"} / ${selectedQuote?.ExpectedDeliveryDays ?? "-"}`;
      sheet.addRow({ field: item.ItemName || item.ItemID, value: info });
    }
    sheet.addRow([]);
  }

  return await workbook.xlsx.writeBuffer();
}

export async function generateEstimationSummaryExcel(estimationId: number): Promise<Uint8Array> {
  const estimation = await getEstimationById(estimationId);
  if (!estimation) throw new Error("Estimation not found");

  const packages = await getPackagesByEstimationId(estimationId);
  const allItems: Record<number, number> = {};
  const allQuotes: Record<number, number> = {};

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID);
    allItems[pkg.PackageID] = items.length;

    let quoteCount = 0;
    for (const item of items) {
      const quotes = await getQuotesByItemId(item.EItemID);
      quoteCount += quotes.length;
    }
    allQuotes[pkg.PackageID] = quoteCount;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Estimation Summary");
  sheet.columns = [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 50 },
  ];

  const estDetails = [
    ["Estimation ID", estimation.EstimationID],
    ["Title", estimation.Title],
    ["Client Name", estimation.ClientName || "-"],
    ["Description", estimation.Description || "-"],
    ["Project Name", estimation.ProjectName || "-"],
    ["Total Material Cost", `$${estimation.TotalMaterialCost?.toFixed(2) || "0.00"}`],
    ["Currency", estimation.CurrencyCode || "-"],
    ["Status", estimation.Status],
    ["Created By", estimation.CreatedByName || "-"],
    ["Date Created", estimation.CreatedAt ? new Date(estimation.CreatedAt).toLocaleDateString() : "-"],
    ["Verified By", estimation.VerifiedByName || "-"],
    ["Date Verified", estimation.VerifiedAt ? new Date(estimation.VerifiedAt).toLocaleDateString() : "-"],
    ["Approved By", estimation.ApprovedByName || "-"],
    ["Date Approved", estimation.ApprovedAt ? new Date(estimation.ApprovedAt).toLocaleDateString() : "-"],
  ];
  estDetails.forEach(([field, value]) => sheet.addRow({ field, value }));

  sheet.addRow([]);
  sheet.addRow(["Package Name", "Item Count / Quote Count / Material Cost / Labor Cost / Duration Days / Created By / Date Created"]);

  for (const pkg of packages) {
    const info = `${allItems[pkg.PackageID] || 0} / ${allQuotes[pkg.PackageID] || 0} / $${pkg.TotalMaterialCost?.toFixed(2) || "0.00"} / $${pkg.TotalLaborCost?.toFixed(2) || "0.00"} / ${pkg.TotalDurationDays ?? "-"} / ${pkg.CreatedByName || "-"} / ${pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : "-"}`;
    sheet.addRow({ field: pkg.PackageName, value: info });
  }

  return await workbook.xlsx.writeBuffer();
}

export async function generatePackageProcurementExcel(packageId: number): Promise<Uint8Array> {
  const pkg = await getPackageById(packageId);
  if (!pkg) throw new Error("Package not found");

  const estimation = await getEstimationById(pkg.EstimationID);
  if (!estimation) throw new Error("Estimation not found");

  const items = await getItemsByPackageId(pkg.PackageID);
  const allQuotes: Record<number, SupplierQuote[]> = {};
  let totalMaterialCost = 0;

  for (const item of items) {
    const quotes = await getQuotesByItemId(item.EItemID);
    allQuotes[item.EItemID] = quotes;
    const selectedQuote = quotes.find(q => q.IsSelected);
    if (selectedQuote) {
      totalMaterialCost += (selectedQuote.QuotedUnitCost || 0) * item.Quantity;
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Package Procurement");
  sheet.columns = [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 50 },
  ];

  const estDetails = [
    ["Estimation ID", estimation.EstimationID],
    ["Title", estimation.Title],
    ["Client Name", estimation.ClientName || "-"],
    ["Description", estimation.Description || "-"],
    ["Project Name", estimation.ProjectName || "-"],
    ["Total Material Cost", `$${totalMaterialCost.toFixed(2)}`],
    ["Currency", estimation.CurrencyCode || "-"],
    ["Status", estimation.Status],
    ["Created By", estimation.CreatedByName || "-"],
    ["Date Created", estimation.CreatedAt ? new Date(estimation.CreatedAt).toLocaleDateString() : "-"],
    ["Verified By", estimation.VerifiedByName || "-"],
    ["Date Verified", estimation.VerifiedAt ? new Date(estimation.VerifiedAt).toLocaleDateString() : "-"],
    ["Approved By", estimation.ApprovedByName || "-"],
    ["Date Approved", estimation.ApprovedAt ? new Date(estimation.ApprovedAt).toLocaleDateString() : "-"],
  ];
  estDetails.forEach(([field, value]) => sheet.addRow({ field, value }));
  sheet.addRow([]);

  sheet.addRow([`Package: ${pkg.PackageName}`]);
  const pkgDetails = [
    ["Package Name", pkg.PackageName],
    ["Description", pkg.Description || "-"],
    ["Total Material Cost (Calculated)", `$${totalMaterialCost.toFixed(2)}`],
    ["Total Labor Cost", `$${pkg.TotalLaborCost?.toFixed(2) || "0.00"}`],
    ["Total Duration Days", pkg.TotalDurationDays ?? "-"],
    ["Sequence", pkg.Sequence ?? "-"],
    ["Created By", pkg.CreatedByName || "-"],
    ["Created At", pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : "-"],
    ["Modified By", pkg.ModifiedByName || "-"],
    ["Modified At", pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : "-"],
  ];
  pkgDetails.forEach(([field, value]) => sheet.addRow({ field, value }));

  sheet.addRow([]);
  sheet.addRow({ field: "Item Name", value: "Quantity / Description / Selected Supplier / Cost / Currency / Delivery Days" });

  for (const item of items) {
    const selectedQuote = (allQuotes[item.EItemID] || []).find(q => q.IsSelected);
    const info = `${item.Quantity} / ${item.Description || "-"} / ${selectedQuote?.SupplierName || "-"} / $${selectedQuote?.QuotedUnitCost?.toFixed(2) || "-"} / ${selectedQuote?.CurrencyCode || "-"} / ${selectedQuote?.ExpectedDeliveryDays ?? "-"}`;
    sheet.addRow({ field: item.ItemName || item.ItemID, value: info });
  }

  return await workbook.xlsx.writeBuffer();
}

export async function generateEstimationProcurementExcel(estimationId: number): Promise<Uint8Array> {
  const estimation = await getEstimationById(estimationId);
  if (!estimation) throw new Error("Estimation not found");

  const packages = await getPackagesByEstimationId(estimationId);
  const allItems: Record<number, EstimationItem[]> = {};
  const allQuotes: Record<number, SupplierQuote[]> = {};
  let totalMaterialCost = 0;

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID);
    allItems[pkg.PackageID] = items;
    for (const item of items) {
      const quotes = await getQuotesByItemId(item.EItemID);
      allQuotes[item.EItemID] = quotes;
      const selectedQuote = quotes.find(q => q.IsSelected);
      if (selectedQuote) {
        totalMaterialCost += (selectedQuote.QuotedUnitCost || 0) * item.Quantity;
      }
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Full Procurement");
  sheet.columns = [
    { header: "Field", key: "field", width: 25 },
    { header: "Value", key: "value", width: 50 },
  ];

  const estDetails = [
    ["Estimation ID", estimation.EstimationID],
    ["Title", estimation.Title],
    ["Client Name", estimation.ClientName || "-"],
    ["Description", estimation.Description || "-"],
    ["Project Name", estimation.ProjectName || "-"],
    ["Total Material Cost (Calculated)", `$${totalMaterialCost.toFixed(2)}`],
    ["Currency", estimation.CurrencyCode || "-"],
    ["Status", estimation.Status],
    ["Created By", estimation.CreatedByName || "-"],
    ["Date Created", estimation.CreatedAt ? new Date(estimation.CreatedAt).toLocaleDateString() : "-"],
    ["Verified By", estimation.VerifiedByName || "-"],
    ["Date Verified", estimation.VerifiedAt ? new Date(estimation.VerifiedAt).toLocaleDateString() : "-"],
    ["Approved By", estimation.ApprovedByName || "-"],
    ["Date Approved", estimation.ApprovedAt ? new Date(estimation.ApprovedAt).toLocaleDateString() : "-"],
  ];
  estDetails.forEach(([field, value]) => sheet.addRow({ field, value }));
  sheet.addRow([]);

  for (const pkg of packages) {
    sheet.addRow([`Package: ${pkg.PackageName}`]);
    const pkgDetails = [
      ["Package Name", pkg.PackageName],
      ["Description", pkg.Description || "-"],
      ["Total Labor Cost", `$${pkg.TotalLaborCost?.toFixed(2) || "0.00"}`],
      ["Total Duration Days", pkg.TotalDurationDays ?? "-"],
      ["Sequence", pkg.Sequence ?? "-"],
      ["Created By", pkg.CreatedByName || "-"],
      ["Created At", pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : "-"],
      ["Modified By", pkg.ModifiedByName || "-"],
      ["Modified At", pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : "-"],
    ];
    pkgDetails.forEach(([field, value]) => sheet.addRow({ field, value }));

    sheet.addRow([]);
    sheet.addRow({ field: "Item Name", value: "Quantity / Description / Selected Supplier / Cost / Currency / Delivery Days" });

    for (const item of allItems[pkg.PackageID] || []) {
      const selectedQuote = (allQuotes[item.EItemID] || []).find(q => q.IsSelected);
      const info = `${item.Quantity} / ${item.Description || "-"} / ${selectedQuote?.SupplierName || "-"} / $${selectedQuote?.QuotedUnitCost?.toFixed(2) || "-"} / ${selectedQuote?.CurrencyCode || "-"} / ${selectedQuote?.ExpectedDeliveryDays ?? "-"}`;
      sheet.addRow({ field: item.ItemName || item.ItemID, value: info });
    }
    sheet.addRow([]);
  }

  return await workbook.xlsx.writeBuffer();
}
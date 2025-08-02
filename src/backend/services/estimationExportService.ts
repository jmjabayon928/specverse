// src/backend/services/estimationExportService.ts
import puppeteer from "puppeteer";
import ExcelJS from "exceljs";
import { Buffer } from "buffer";

import { getFilteredEstimations } from "@/backend/database/estimationQueries";
import { getEstimationById } from "../database/estimationQueries";
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
  const estimations = await getFilteredEstimations(statuses, clients, projects, search);

  const html = `
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
        ${estimations.map(est => `
          <tr>
            <td>${est.EstimationID}</td>
            <td>${est.Title}</td>
            <td>${est.Description || "-"}</td>
            <td>${est.Status}</td>
            <td>${est.ClientName || "-"}</td>
            <td>${est.ProjectName || "-"}</td>
            <td>${est.CreatedAt ? new Date(est.CreatedAt).toLocaleDateString() : "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    </body></html>
  `;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "7mm", right: "7mm" },
  });

  await browser.close();

  return Buffer.from(pdfBuffer);
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
          <td>${item.CreatedByName || "-"}</td>
          <td>${item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString() : '-'}</td>
        </tr>
      `;

      const quotes = allQuotes[item.EItemID] || [];
      if (quotes.length > 0) {
        htmlContent += `
        <tr><td colspan="5">
          <table class="quote-table">
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
              <td>$${quote.QuotedUnitCost.toFixed(2)}</td>
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

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "7mm", right: "7mm" },
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
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

  // Puppeteer: Generate PDF
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" }
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
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

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" }
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
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

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" }
  });

  await browser.close();
  return Buffer.from(pdfBuffer);
}

export async function generateEstimationExcel(estimationId: number): Promise<Buffer> {
  const estimation = await getEstimationById(estimationId);
  if (!estimation) throw new Error("Estimation not found");

  const packages = await getPackagesByEstimationId(estimationId);
  const allItems: Record<number, EstimationItem[]> = {};

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID);
    allItems[pkg.PackageID] = items;
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Estimation");
  sheet.columns = Array(8).fill({ width: 18 });

  let rowIdx = 1;

  const addSpacer = () => {
    sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
    rowIdx++;
  };

  const addThinBorder = (row: ExcelJS.Row) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  };

  const merge4Pair = (
    label1: string,
    value1: string | number,
    label2: string,
    value2: string | number
  ) => {
    sheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
    sheet.mergeCells(`C${rowIdx}:D${rowIdx}`);
    sheet.mergeCells(`E${rowIdx}:F${rowIdx}`);
    sheet.mergeCells(`G${rowIdx}:H${rowIdx}`);
    const row = sheet.getRow(rowIdx++);
    row.getCell(1).value = label1;
    row.getCell(3).value = value1 ?? "-";
    row.getCell(5).value = label2;
    row.getCell(7).value = value2 ?? "-";
    addThinBorder(row);
  };

  // Title and Subtitle
  sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  sheet.getRow(rowIdx).getCell(1).value = "Estimation Report";
  sheet.getRow(rowIdx).font = { size: 16, bold: true };
  rowIdx++;

  sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  sheet.getRow(rowIdx).getCell(1).value = estimation.Title;
  sheet.getRow(rowIdx).font = { size: 14, bold: true };
  rowIdx++;

  addSpacer(); // spacer between title and estimation details

  // Estimation Details
  const estDetails: [string, string | number, string, string | number][] = [
    ["Estimation ID", estimation.EstimationID, "Title", estimation.Title],
    ["Client Name", estimation.ClientName || "-", "Description", estimation.Description || "-"],
    ["Project Name", estimation.ProjectName || "-", "Total Material Cost", `$${estimation.TotalMaterialCost?.toFixed(2) || "0.00"}`],
    ["Currency", estimation.CurrencyCode || "-", "Status", estimation.Status || "-"],
    ["Created By", estimation.CreatedByName || "-", "Date Created", new Date(estimation.CreatedAt).toLocaleDateString()],
    ["Verified By", estimation.VerifiedByName || "-", "Date Verified", new Date(estimation.VerifiedAt).toLocaleDateString()],
    ["Approved By", estimation.ApprovedByName || "-", "Date Approved", new Date(estimation.ApprovedAt).toLocaleDateString()],
  ];
  estDetails.forEach(([a, b, c, d]) => merge4Pair(a, b, c, d));

  addSpacer(); // spacer between estimation details and first package

  for (const pkg of packages) {
    // Package Title
    sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
    sheet.getRow(rowIdx).getCell(1).value = `Package: ${pkg.PackageName}`;
    sheet.getRow(rowIdx).font = { bold: true, size: 13 };
    rowIdx++;

    const pkgDetails: [string, string | number, string, string | number][] = [
      ["Package Name", pkg.PackageName || "-", "Total Material Cost", `$${pkg.TotalMaterialCost?.toFixed(2) || "0.00"}`],
      ["Description", pkg.Description || "-", "Total Labor Cost", `$${pkg.TotalLaborCost?.toFixed(2) || "0.00"}`],
      ["Sequence", pkg.Sequence ?? "-", "Total Duration Days", pkg.TotalDurationDays ?? "-"],
      ["Created By", pkg.CreatedByName || "-", "Created At", pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : "-"],
      ["Modified By", pkg.ModifiedByName || "-", "Modified At", pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : "-"],
    ];
    pkgDetails.forEach(([a, b, c, d]) => merge4Pair(a, b, c, d));

    rowIdx++;

    // Item Table Header
    sheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
    sheet.mergeCells(`D${rowIdx}:F${rowIdx}`);
    const itemHead = sheet.getRow(rowIdx++);
    itemHead.getCell(1).value = "Item Name";
    itemHead.getCell(3).value = "Qty";
    itemHead.getCell(4).value = "Description";
    itemHead.getCell(7).value = "Created By";
    itemHead.getCell(8).value = "Created At";

    itemHead.font = { bold: true };
    itemHead.alignment = { vertical: "middle" };
    itemHead.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    itemHead.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    itemHead.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    itemHead.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    itemHead.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
    addThinBorder(itemHead);

    for (const item of allItems[pkg.PackageID] || []) {
      sheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
      sheet.mergeCells(`D${rowIdx}:F${rowIdx}`);
      const row = sheet.getRow(rowIdx++);
      row.getCell(1).value = item.ItemName || item.ItemID;
      row.getCell(3).value = item.Quantity;
      row.getCell(4).value = item.Description || "-";
      row.getCell(7).value = item.CreatedByName || "-";
      row.getCell(8).value = item.CreatedAt ? new Date(item.CreatedAt).toLocaleDateString() : "-";

      row.getCell(3).alignment = { horizontal: "center" };
      row.getCell(7).alignment = { horizontal: "center" };
      row.getCell(8).alignment = { horizontal: "center" };
      addThinBorder(row);
    }

    addSpacer(); // spacer before next package
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateEstimationSummaryExcel(estimationId: number): Promise<Buffer> {
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Estimation Summary");
  sheet.columns = Array(8).fill({ width: 18 });

  let rowIdx = 1;

  const addThinBorder = (row: ExcelJS.Row) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  };

  const merge4Pair = (
    label1: string,
    value1: string | number,
    label2: string,
    value2: string | number
  ) => {
    sheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
    sheet.mergeCells(`C${rowIdx}:D${rowIdx}`);
    sheet.mergeCells(`E${rowIdx}:F${rowIdx}`);
    sheet.mergeCells(`G${rowIdx}:H${rowIdx}`);
    const row = sheet.getRow(rowIdx++);
    row.getCell(1).value = label1;
    row.getCell(3).value = value1;
    row.getCell(5).value = label2;
    row.getCell(7).value = value2;
    addThinBorder(row);
  };

  // Title
  sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  sheet.getRow(rowIdx).getCell(1).value = "Estimation Summary";
  sheet.getRow(rowIdx).font = { size: 16, bold: true };
  rowIdx++;

  sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  sheet.getRow(rowIdx).getCell(1).value = estimation.Title;
  sheet.getRow(rowIdx).font = { size: 14, bold: true };
  rowIdx++;

  rowIdx++; // Spacer

  const estDetails: [string, string | number, string, string | number][] = [
    ["Estimation ID", estimation.EstimationID, "Title", estimation.Title],
    ["Client Name", estimation.ClientName || "-", "Description", estimation.Description || "-"],
    ["Project Name", estimation.ProjectName || "-", "Total Material Cost", `$${estimation.TotalMaterialCost?.toFixed(2) || "0.00"}`],
    ["Currency", estimation.CurrencyCode || "-", "Status", estimation.Status || "-"],
    ["Created By", estimation.CreatedByName || "-", "Date Created", new Date(estimation.CreatedAt).toLocaleDateString()],
    ["Verified By", estimation.VerifiedByName || "-", "Date Verified", new Date(estimation.VerifiedAt).toLocaleDateString()],
    ["Approved By", estimation.ApprovedByName || "-", "Date Approved", new Date(estimation.ApprovedAt).toLocaleDateString()],
  ];
  estDetails.forEach(([a, b, c, d]) => merge4Pair(a, b, c, d));

  rowIdx++; // Spacer

  // Section title
  sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  const legendRow = sheet.getRow(rowIdx++);
  legendRow.getCell(1).value = "Packages Overview";
  legendRow.font = { bold: true, size: 13 };

  // Header
  sheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
  const headerRow = sheet.getRow(rowIdx++);
  headerRow.getCell(1).value = "Package Name";
  headerRow.getCell(4).value = "Item Count";
  headerRow.getCell(5).value = "Quote Count";
  headerRow.getCell(6).value = "Material Cost";
  headerRow.getCell(7).value = "Labor Cost";
  headerRow.getCell(8).value = "Duration (days)";
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.alignment = { horizontal: "center" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9D9D9" },
    };
  });

  // Package rows
  for (const pkg of packages) {
    sheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
    const row = sheet.getRow(rowIdx++);
    row.getCell(1).value = pkg.PackageName;
    row.getCell(4).value = allItems[pkg.PackageID] || 0;
    row.getCell(5).value = allQuotes[pkg.PackageID] || 0;
    row.getCell(6).value = `$${pkg.TotalMaterialCost?.toFixed(2) || "0.00"}`;
    row.getCell(7).value = `$${pkg.TotalLaborCost?.toFixed(2) || "0.00"}`;
    row.getCell(8).value = pkg.TotalDurationDays ?? "-";
    addThinBorder(row);
  }

  // Total row
  sheet.mergeCells(`A${rowIdx}:C${rowIdx}`);
  const totalRow = sheet.getRow(rowIdx++);
  totalRow.getCell(1).value = "Total";
  totalRow.getCell(4).value = totalItems;
  totalRow.getCell(5).value = totalQuotes;
  totalRow.getCell(6).value = `$${totalMaterial.toFixed(2)}`;
  totalRow.getCell(7).value = `$${totalLabor.toFixed(2)}`;
  totalRow.getCell(8).value = totalDuration;
  totalRow.font = { bold: true };
  totalRow.eachCell(cell => {
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generatePackageProcurementExcel(packageId: number): Promise<Buffer> {
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

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function generateEstimationProcurementExcel(estimationId: number): Promise<Buffer> {
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
  const sheet = workbook.addWorksheet("Procurement Sheet");
  sheet.columns = Array(8).fill({ width: 18 });

  let rowIdx = 1;

  const addThinBorder = (row: ExcelJS.Row) => {
    row.eachCell(cell => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  };

  const merge4Pair = (
    label1: string,
    value1: string | number,
    label2: string,
    value2: string | number
  ) => {
    sheet.mergeCells(`A${rowIdx}:B${rowIdx}`);
    sheet.mergeCells(`C${rowIdx}:D${rowIdx}`);
    sheet.mergeCells(`E${rowIdx}:F${rowIdx}`);
    sheet.mergeCells(`G${rowIdx}:H${rowIdx}`);
    const row = sheet.getRow(rowIdx++);
    row.getCell(1).value = label1;
    row.getCell(3).value = value1;
    row.getCell(5).value = label2;
    row.getCell(7).value = value2;
    addThinBorder(row);
  };

  // Title and subtitle
  sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  sheet.getRow(rowIdx).getCell(1).value = "Estimation Procurement Sheet";
  sheet.getRow(rowIdx).font = { size: 16, bold: true };
  rowIdx++;

  sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
  sheet.getRow(rowIdx).getCell(1).value = estimation.Title;
  sheet.getRow(rowIdx).font = { size: 14, bold: true };
  rowIdx++;

  rowIdx++; // Spacer

  const estDetails: [string, string | number, string, string | number][] = [
    ["Estimation ID", estimation.EstimationID, "Title", estimation.Title],
    ["Client Name", estimation.ClientName || "-", "Description", estimation.Description || "-"],
    ["Project Name", estimation.ProjectName || "-", "Total Material Cost", `$${estimation.TotalMaterialCost?.toFixed(2) || "0.00"}`],
    ["Currency", estimation.CurrencyCode || "-", "Status", estimation.Status || "-"],
    ["Created By", estimation.CreatedByName || "-", "Date Created", new Date(estimation.CreatedAt).toLocaleDateString()],
    ["Verified By", estimation.VerifiedByName || "-", "Date Verified", new Date(estimation.VerifiedAt).toLocaleDateString()],
    ["Approved By", estimation.ApprovedByName || "-", "Date Approved", new Date(estimation.ApprovedAt).toLocaleDateString()],
  ];
  estDetails.forEach(([a, b, c, d]) => merge4Pair(a, b, c, d));

  rowIdx++; // Spacer

  for (const pkg of packages) {
    // Package title
    sheet.mergeCells(`A${rowIdx}:H${rowIdx}`);
    sheet.getRow(rowIdx).getCell(1).value = pkg.PackageName || "Unnamed Package";
    sheet.getRow(rowIdx).font = { bold: true, size: 13 };
    rowIdx++;

    const pkgDetails: [string, string | number, string, string | number][] = [
      ["Package Name", pkg.PackageName || "-", "Total Material Cost", `$${pkg.TotalMaterialCost?.toFixed(2) || "0.00"}`],
      ["Description", pkg.Description || "-", "Total Labor Cost", `$${pkg.TotalLaborCost?.toFixed(2) || "0.00"}`],
      ["Sequence", pkg.Sequence ?? "-", "Total Duration (days)", pkg.TotalDurationDays ?? "-"],
      ["Created By", pkg.CreatedByName || "-", "Date Created", pkg.CreatedAt ? new Date(pkg.CreatedAt).toLocaleDateString() : "-"],
      ["Modified By", pkg.ModifiedByName || "-", "Date Modified", pkg.ModifiedAt ? new Date(pkg.ModifiedAt).toLocaleDateString() : "-"],
    ];
    pkgDetails.forEach(([a, b, c, d]) => merge4Pair(a, b, c, d));

    rowIdx++;

    // Items and Selected Quotes Header
    sheet.mergeCells(`C${rowIdx}:D${rowIdx}`);
    const headerRow = sheet.getRow(rowIdx++);
    headerRow.getCell(1).value = "Item Name";
    headerRow.getCell(2).value = "Quantity";
    headerRow.getCell(3).value = "Description";
    headerRow.getCell(5).value = "Selected Supplier";
    headerRow.getCell(6).value = "Unit Cost";
    headerRow.getCell(7).value = "Currency";
    headerRow.getCell(8).value = "Delivery Days";

    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.alignment = { horizontal: "center" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" },
      };
    });

    // Item rows
    for (const item of allItems[pkg.PackageID] || []) {
      const selectedQuote = (allQuotes[item.EItemID] || []).find(q => q.IsSelected);
      sheet.mergeCells(`C${rowIdx}:D${rowIdx}`);
      const row = sheet.getRow(rowIdx++);
      row.getCell(1).value = item.ItemName || item.ItemID;
      row.getCell(2).value = item.Quantity;
      row.getCell(3).value = item.Description || "-";
      row.getCell(5).value = selectedQuote?.SupplierName || "-";
      row.getCell(6).value = selectedQuote ? `$${selectedQuote.QuotedUnitCost?.toFixed(2)}` : "-";
      row.getCell(7).value = selectedQuote?.CurrencyCode || "-";
      row.getCell(8).value = selectedQuote?.ExpectedDeliveryDays ?? "-";
      addThinBorder(row);
    }

    rowIdx++; // Spacer before next package
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
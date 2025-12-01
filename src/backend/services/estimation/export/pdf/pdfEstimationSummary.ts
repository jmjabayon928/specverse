// src/backend/services/estimation/export/pdf/pdfEstimationSummary.ts

import puppeteer from 'puppeteer'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackagesByEstimationId } from '@/backend/database/estimationPackageQueries'
import { getItemsByPackageId } from '@/backend/database/estimationItemQueries'
import { getQuotesByItemId } from '@/backend/database/estimationQuoteQueries'

import { formatDate } from '../common/exportHelpers'
import type { EstimationItem, SupplierQuote } from '@/domain/estimations/estimationTypes'

type EstimationRow = {
  EstimationID: number
  EstimationTitle: string
  EstimationDescription?: string | null
  Status: string
  ClientName: string
  ProjName: string
  CurrencyCode?: string | null
  TotalCost?: number | null
  CreatedByName?: string | null
  CreatedAt?: string | Date | null
  VerifiedByName?: string | null
  VerifiedAt?: string | number | Date | null
  ApprovedByName?: string | null
  ApprovedAt?: string | number | Date | null
}

type EstimationPackageRow = {
  PackageID: number
  PackageName: string
  PackageDescription?: string | null
  Status: string
  CreatedByName?: string | null
  CreatedAt?: string | Date | null
}

type EstimationSummaryContext = {
  estimation: EstimationRow
  packages: EstimationPackageRow[]
  packageItems: Record<number, EstimationItem[]>
  itemQuotes: Record<number, SupplierQuote[]>
}

export const generateEstimationPdf = async (
  estimationId: number,
): Promise<Buffer> => {
  const estimation = await getEstimationById(
    estimationId,
  ) as EstimationRow | null

  if (!estimation) {
    throw new Error('Estimation not found')
  }

  const packages = await getPackagesByEstimationId(
    estimationId,
  ) as EstimationPackageRow[]

  const packageItems: Record<number, EstimationItem[]> = {}
  const itemQuotes: Record<number, SupplierQuote[]> = {}

  for (const pkg of packages) {
    const items = await getItemsByPackageId(pkg.PackageID) as EstimationItem[]
    packageItems[pkg.PackageID] = items

    for (const item of items) {
      const quotes = await getQuotesByItemId(
        item.EItemID,
      ) as SupplierQuote[]
      itemQuotes[item.EItemID] = quotes
    }
  }

  const ctx: EstimationSummaryContext = {
    estimation,
    packages,
    packageItems,
    itemQuotes,
  }

  const html = buildEstimationHtml(ctx)

  const browser = await puppeteer.launch({
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm',
      },
    })

    return Buffer.from(pdfBuffer)
  } finally {
    await browser.close()
  }
}

const buildEstimationHtml = (ctx: EstimationSummaryContext): string => {
  const { estimation, packages, packageItems, itemQuotes } = ctx

  const packagesHtml = packages
    .map(pkg => {
      const items = packageItems[pkg.PackageID] ?? []

      const itemsHtml = items
        .map(item => {
          const quotes = itemQuotes[item.EItemID] ?? []

          const quotesHtml =
            quotes.length > 0
              ? `
                <tr>
                  <td colspan="5">
                    <strong>Supplier Quotes:</strong>
                    <table style="width: 100%; margin-top: 5px;">
                      <thead>
                        <tr>
                          <th>Supplier</th>
                          <th>Unit Cost</th>
                          <th>Currency</th>
                          <th>Delivery Days</th>
                          <th>Notes</th>
                          <th>Selected</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${quotes
                          .map(
                            quote => `
                              <tr style="${
                                quote.IsSelected ? 'background-color: #d1fae5;' : ''
                              }">
                                <td>${quote.SupplierName}</td>
                                <td>${quote.QuotedUnitCost}</td>
                                <td>${quote.CurrencyCode || '-'}</td>
                                <td>${quote.ExpectedDeliveryDays ?? '-'}</td>
                                <td>${quote.Notes || '-'}</td>
                                <td>${quote.IsSelected ? 'Yes' : 'No'}</td>
                              </tr>
                            `,
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </td>
                </tr>
              `
              : ''

          return `
            <tr>
              <td>${item.ItemName}</td>
              <td>${item.Quantity}</td>
              <td>${item.Description || '-'}</td>
              <td>${item.CreatedByName || '-'}</td>
              <td>${item.CreatedAt ? formatDate(item.CreatedAt) : '-'}</td>
            </tr>
            ${quotesHtml}
          `
        })
        .join('')

      return `
        <div class="package-section">
          <div class="package-header">
            Package: ${pkg.PackageName} (Status: ${pkg.Status})
          </div>
          <div><strong>Description:</strong> ${pkg.PackageDescription || '-'}</div>
          <table>
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Quantity</th>
                <th>Description</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
      `
    })
    .join('')

  const html = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; }
          h1, h2, h3 { margin-bottom: 5px; }
          h1 { text-align: center; }
          .section { margin-bottom: 20px; }
          .section-title {
            font-size: 16px;
            margin-bottom: 10px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ccc; padding: 6px; }
          th { background-color: #f2f2f2; }
          .package-section { margin-top: 20px; }
          .package-header {
            font-weight: bold;
            background-color: #e9ecef;
            padding: 8px;
            margin-bottom: 5px;
          }
          .summary-table {
            width: 60%;
            margin-top: 10px;
            border-collapse: collapse;
          }
          .summary-table td {
            border: 1px solid #ccc;
            padding: 6px;
          }
        </style>
      </head>
      <body>
        <h1>Estimation Report</h1>

        <div class="section">
          <div class="section-title">Estimation Summary</div>
          <table class="summary-table">
            <tr>
              <td><strong>Estimation ID</strong></td>
              <td>${estimation.EstimationID}</td>
            </tr>
            <tr>
              <td><strong>Title</strong></td>
              <td>${estimation.EstimationTitle}</td>
            </tr>
            <tr>
              <td><strong>Description</strong></td>
              <td>${estimation.EstimationDescription || '-'}</td>
            </tr>
            <tr>
              <td><strong>Status</strong></td>
              <td>${estimation.Status}</td>
            </tr>
            <tr>
              <td><strong>Client</strong></td>
              <td>${estimation.ClientName}</td>
            </tr>
            <tr>
              <td><strong>Project</strong></td>
              <td>${estimation.ProjName}</td>
            </tr>
            <tr>
              <td><strong>Currency</strong></td>
              <td>${estimation.CurrencyCode || '-'}</td>
            </tr>
            <tr>
              <td><strong>Total Cost</strong></td>
              <td>${estimation.TotalCost ?? '-'}</td>
            </tr>
            <tr>
              <td><strong>Created By</strong></td>
              <td>${estimation.CreatedByName || '-'}</td>
            </tr>
            <tr>
              <td><strong>Created At</strong></td>
              <td>${estimation.CreatedAt ? formatDate(estimation.CreatedAt) : '-'}</td>
            </tr>
            <tr>
              <td><strong>Verified By</strong></td>
              <td>${estimation.VerifiedByName || '-'}</td>
            </tr>
            <tr>
              <td><strong>Date Verified</strong></td>
              <td>${formatDate(estimation.VerifiedAt)}</td>
            </tr>
            <tr>
              <td><strong>Approved By</strong></td>
              <td>${estimation.ApprovedByName || '-'}</td>
            </tr>
            <tr>
              <td><strong>Date Approved</strong></td>
              <td>${formatDate(estimation.ApprovedAt)}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Packages</div>
          ${packagesHtml}
        </div>
      </body>
    </html>
  `

  return html
}

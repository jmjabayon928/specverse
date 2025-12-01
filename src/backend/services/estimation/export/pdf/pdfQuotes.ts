// src/backend/services/estimation/export/pdf/pdfQuotes.ts

import puppeteer from 'puppeteer'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackageById } from '@/backend/database/estimationPackageQueries'
import { getItemsByPackageId } from '@/backend/database/estimationItemQueries'
import { getQuotesByItemId } from '@/backend/database/estimationQuoteQueries'

// NOTE: Use a relative import so we don't depend on the @ alias here.
// This path is from: src/backend/services/estimation/export/pdf/pdfQuotes.ts
// back up to src/, then into domain/estimation/estimationTypes.
import type {
  EstimationItem,
  EstimationQuote,
} from '@/domain/estimations/estimationTypes'

type EstimationRow = {
  EstimationID: number
  EstimationTitle: string
  ClientName: string
  ProjName: string
}

type EstimationPackageRow = {
  PackageID: number
  PackageName: string
  PackageDescription?: string | null
  Status: string
  EstimationID?: number | null
}

type QuotesPdfContext = {
  estimation: EstimationRow
  packageData: EstimationPackageRow
  item: EstimationItem
  quotes: EstimationQuote[]
}

export const generateEstimationQuotesPdf = async (
  itemId: number,
): Promise<Buffer> => {
  // getItemsByPackageId(itemId) and take the first item.
  const itemList = await getItemsByPackageId(itemId) as EstimationItem[]

  if (!itemList || itemList.length === 0) {
    throw new Error('Item not found')
  }

  const item = itemList[0]

  const quotes = await getQuotesByItemId(
    itemId,
  ) as EstimationQuote[]

  const packageData = await getPackageById(
    item.PackageID ?? 0,
  ) as EstimationPackageRow | null

  if (!packageData) {
    throw new Error('Package not found')
  }

  const estimation = await getEstimationById(
    packageData.EstimationID ?? 0,
  ) as EstimationRow | null

  if (!estimation) {
    throw new Error('Estimation not found')
  }

  const ctx: QuotesPdfContext = {
    estimation,
    packageData,
    item,
    quotes,
  }

  const html = buildQuotesHtml(ctx)

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

const buildQuotesHtml = (ctx: QuotesPdfContext): string => {
  const { estimation, packageData, item, quotes } = ctx

  const packageDescription = packageData.PackageDescription || '-'

  const quotesRowsHtml = quotes
    .map(quote => {
      const notes = quote.Notes || '-'
      const currency = quote.Currency || '-'
      const deliveryDays = quote.ExpectedDeliveryDays ?? '-'
      const selectedLabel = quote.IsSelected ? 'Yes' : 'No'
      const rowStyle = quote.IsSelected ? 'background-color: #d1fae5;' : ''

      return `
        <tr style="${rowStyle}">
          <td>${quote.QuoteID}</td>
          <td>${quote.SupplierName ?? '-'}</td>
          <td>${quote.UnitCost}</td>
          <td>${currency}</td>
          <td>${deliveryDays}</td>
          <td>${notes}</td>
          <td>${selectedLabel}</td>
        </tr>
      `
    })
    .join('')

  return `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 11px;
            padding: 20px;
            color: #333333;
          }
          h1 {
            text-align: center;
            margin-bottom: 16px;
          }
          .section {
            margin-bottom: 20px;
          }
          .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
            border-bottom: 1px solid #cccccc;
            padding-bottom: 4px;
          }
          .summary-table {
            border-collapse: collapse;
            width: 70%;
          }
          .summary-table td {
            border: 1px solid #cccccc;
            padding: 6px;
          }
          .summary-table td:first-child {
            font-weight: bold;
            width: 30%;
          }
          table.quotes-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table.quotes-table th,
          table.quotes-table td {
            border: 1px solid #cccccc;
            padding: 6px;
            text-align: left;
          }
          table.quotes-table th {
            background-color: #f0f0f0;
          }
        </style>
      </head>
      <body>
        <h1>Supplier Quotes</h1>

        <div class="section">
          <div class="section-title">Estimation, Package & Item Details</div>
          <table class="summary-table">
            <tr>
              <td>Estimation ID</td>
              <td>${estimation.EstimationID}</td>
            </tr>
            <tr>
              <td>Estimation Title</td>
              <td>${estimation.EstimationTitle}</td>
            </tr>
            <tr>
              <td>Client</td>
              <td>${estimation.ClientName}</td>
            </tr>
            <tr>
              <td>Project</td>
              <td>${estimation.ProjName}</td>
            </tr>
            <tr>
              <td>Package ID</td>
              <td>${packageData.PackageID}</td>
            </tr>
            <tr>
              <td>Package Name</td>
              <td>${packageData.PackageName}</td>
            </tr>
            <tr>
              <td>Package Description</td>
              <td>${packageDescription}</td>
            </tr>
            <tr>
              <td>Package Status</td>
              <td>${packageData.Status}</td>
            </tr>
            <tr>
              <td>Item ID</td>
              <td>${item.EItemID}</td>
            </tr>
            <tr>
              <td>Item Name</td>
              <td>${item.ItemName ?? '-'}</td>
            </tr>
            <tr>
              <td>Item Description</td>
              <td>${item.Description || '-'}</td>
            </tr>
            <tr>
              <td>Quantity</td>
              <td>${item.Quantity}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Quotes</div>
          <table class="quotes-table">
            <thead>
              <tr>
                <th>Quote ID</th>
                <th>Supplier</th>
                <th>Unit Cost</th>
                <th>Currency</th>
                <th>Delivery Days</th>
                <th>Notes</th>
                <th>Selected</th>
              </tr>
            </thead>
            <tbody>
              ${quotesRowsHtml}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `
}

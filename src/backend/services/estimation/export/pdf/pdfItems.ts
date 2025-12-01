// src/backend/services/estimation/export/pdf/pdfItems.ts

import puppeteer from 'puppeteer'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackageById } from '@/backend/database/estimationPackageQueries'
import { getItemsByPackageId } from '@/backend/database/estimationItemQueries'

import { formatDate } from '../common/exportHelpers'
import type { EstimationItem } from '@/domain/estimations/estimationTypes'

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
  CreatedByName?: string | null
  CreatedAt?: string | Date | null
  EstimationID?: number | null
}

type ItemsPdfContext = {
  estimation: EstimationRow
  packageData: EstimationPackageRow
  items: EstimationItem[]
}

export const generateEstimationItemsPdf = async (
  packageId: number,
): Promise<Buffer> => {
  const packageData = await getPackageById(
    packageId,
  ) as EstimationPackageRow | null

  if (!packageData) {
    throw new Error('Package not found')
  }

  const estimationId = packageData.EstimationID ?? 0
  const estimation = await getEstimationById(
    estimationId,
  ) as EstimationRow | null

  if (!estimation) {
    throw new Error('Estimation not found')
  }

  const items = await getItemsByPackageId(packageId) as EstimationItem[]

  const ctx: ItemsPdfContext = {
    estimation,
    packageData,
    items,
  }

  const html = buildItemsHtml(ctx)

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

const buildItemsHtml = (ctx: ItemsPdfContext): string => {
  const { estimation, packageData, items } = ctx

  const itemsRowsHtml = items
    .map(item => {
      const description = item.Description || '-'
      const createdBy = item.CreatedByName || '-'
      const createdAt = item.CreatedAt ? formatDate(item.CreatedAt) : '-'

      return `
        <tr>
          <td>${item.EItemID}</td>
          <td>${item.ItemName}</td>
          <td>${description}</td>
          <td>${item.Quantity}</td>
          <td>${createdBy}</td>
          <td>${createdAt}</td>
        </tr>
      `
    })
    .join('')

  const packageCreatedAt = packageData.CreatedAt
    ? formatDate(packageData.CreatedAt)
    : '-'

  const packageDescription = packageData.PackageDescription || '-'

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
          table.items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table.items-table th,
          table.items-table td {
            border: 1px solid #cccccc;
            padding: 6px;
            text-align: left;
          }
          table.items-table th {
            background-color: #f0f0f0;
          }
        </style>
      </head>
      <body>
        <h1>Estimation Items</h1>

        <div class="section">
          <div class="section-title">Estimation & Package Details</div>
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
              <td>Package Created By</td>
              <td>${packageData.CreatedByName || '-'}</td>
            </tr>
            <tr>
              <td>Package Created At</td>
              <td>${packageCreatedAt}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Items</div>
          <table class="items-table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Item Name</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRowsHtml}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `
}

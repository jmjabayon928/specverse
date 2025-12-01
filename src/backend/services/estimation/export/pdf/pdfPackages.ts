// src/backend/services/estimation/export/pdf/pdfPackages.ts

import puppeteer from 'puppeteer'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackagesByEstimationId } from '@/backend/database/estimationPackageQueries'

import { formatDate } from '../common/exportHelpers'

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

type PackagesPdfContext = {
  estimation: EstimationRow
  packages: EstimationPackageRow[]
}

export const generateEstimationPackagesPdf = async (
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

  const ctx: PackagesPdfContext = {
    estimation,
    packages,
  }

  const html = buildPackagesHtml(ctx)

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

const buildPackagesHtml = (ctx: PackagesPdfContext): string => {
  const { estimation, packages } = ctx

  const createdAt = estimation.CreatedAt
    ? formatDate(estimation.CreatedAt)
    : '-'

  const verifiedAt = formatDate(estimation.VerifiedAt)
  const approvedAt = formatDate(estimation.ApprovedAt)

  const packagesRowsHtml = packages
    .map(pkg => {
      const description = pkg.PackageDescription || '-'
      const createdBy = pkg.CreatedByName || '-'
      const pkgCreatedAt = pkg.CreatedAt ? formatDate(pkg.CreatedAt) : '-'

      return `
        <tr>
          <td>${pkg.PackageID}</td>
          <td>${pkg.PackageName}</td>
          <td>${description}</td>
          <td>${pkg.Status}</td>
          <td>${createdBy}</td>
          <td>${pkgCreatedAt}</td>
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
          table.packages-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          table.packages-table th,
          table.packages-table td {
            border: 1px solid #cccccc;
            padding: 6px;
            text-align: left;
          }
          table.packages-table th {
            background-color: #f0f0f0;
          }
        </style>
      </head>
      <body>
        <h1>Estimation Packages</h1>

        <div class="section">
          <div class="section-title">Estimation Details</div>
          <table class="summary-table">
            <tr>
              <td>Estimation ID</td>
              <td>${estimation.EstimationID}</td>
            </tr>
            <tr>
              <td>Title</td>
              <td>${estimation.EstimationTitle}</td>
            </tr>
            <tr>
              <td>Description</td>
              <td>${estimation.EstimationDescription || '-'}</td>
            </tr>
            <tr>
              <td>Status</td>
              <td>${estimation.Status}</td>
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
              <td>Currency</td>
              <td>${estimation.CurrencyCode || '-'}</td>
            </tr>
            <tr>
              <td>Total Cost</td>
              <td>${estimation.TotalCost ?? '-'}</td>
            </tr>
            <tr>
              <td>Created By</td>
              <td>${estimation.CreatedByName || '-'}</td>
            </tr>
            <tr>
              <td>Created At</td>
              <td>${createdAt}</td>
            </tr>
            <tr>
              <td>Verified By</td>
              <td>${estimation.VerifiedByName || '-'}</td>
            </tr>
            <tr>
              <td>Date Verified</td>
              <td>${verifiedAt}</td>
            </tr>
            <tr>
              <td>Approved By</td>
              <td>${estimation.ApprovedByName || '-'}</td>
            </tr>
            <tr>
              <td>Date Approved</td>
              <td>${approvedAt}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <div class="section-title">Packages</div>
          <table class="packages-table">
            <thead>
              <tr>
                <th>Package ID</th>
                <th>Package Name</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              ${packagesRowsHtml}
            </tbody>
          </table>
        </div>
      </body>
    </html>
  `
}

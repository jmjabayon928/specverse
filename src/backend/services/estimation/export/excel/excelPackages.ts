// src/backend/services/estimation/export/excel/excelPackages.ts

import ExcelJS from 'exceljs'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackagesByEstimationId } from '@/backend/database/estimationPackageQueries'

import {
  formatDate,
  autoFitColumns,
  addMergedTitleRow,
  addSectionHeaderRow,
} from '../common/exportHelpers'

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

type DetailRow = [string, string | number | null]

export const generateEstimationPackagesExcelWorkbook = async (
  estimationId: number,
): Promise<ExcelJS.Workbook> => {
  const estimation = await getEstimationById(
    estimationId,
  ) as EstimationRow | null

  if (!estimation) {
    throw new Error('Estimation not found')
  }

  const packages = await getPackagesByEstimationId(
    estimationId,
  ) as EstimationPackageRow[]

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Estimation Packages')

  buildPackagesSheet(sheet, {
    estimation,
    packages,
  })

  autoFitColumns(sheet)

  return workbook
}

interface PackagesSheetContext {
  estimation: EstimationRow
  packages: EstimationPackageRow[]
}

const buildPackagesSheet = (
  sheet: ExcelJS.Worksheet,
  ctx: PackagesSheetContext,
): void => {
  const { estimation, packages } = ctx

  // Title row
  addMergedTitleRow(sheet, 'Estimation Packages', 'F')

  sheet.addRow([])

  // Estimation details section
  addSectionHeaderRow(sheet, 'Estimation Details')

  const details: DetailRow[] = [
    ['Estimation ID', estimation.EstimationID],
    ['Title', estimation.EstimationTitle],
    ['Description', estimation.EstimationDescription || '-'],
    ['Status', estimation.Status],
    ['Client', estimation.ClientName],
    ['Project', estimation.ProjName],
    ['Currency', estimation.CurrencyCode || '-'],
    ['Total Cost', estimation.TotalCost ?? '-'],
    ['Created By', estimation.CreatedByName || '-'],
    [
      'Created At',
      estimation.CreatedAt ? formatDate(estimation.CreatedAt) : '-',
    ],
    ['Verified By', estimation.VerifiedByName || '-'],
    ['Date Verified', formatDate(estimation.VerifiedAt)],
    ['Approved By', estimation.ApprovedByName || '-'],
    ['Date Approved', formatDate(estimation.ApprovedAt)],
  ]

  for (const row of details) {
    sheet.addRow(row)
  }

  sheet.addRow([])

  // Packages section
  addSectionHeaderRow(sheet, 'Packages')

  sheet.addRow([
    'Package ID',
    'Package Name',
    'Description',
    'Status',
    'Created By',
    'Created At',
  ])

  for (const pkg of packages) {
    sheet.addRow([
      pkg.PackageID,
      pkg.PackageName,
      pkg.PackageDescription || '-',
      pkg.Status,
      pkg.CreatedByName || '-',
      pkg.CreatedAt ? formatDate(pkg.CreatedAt) : '-',
    ])
  }
}

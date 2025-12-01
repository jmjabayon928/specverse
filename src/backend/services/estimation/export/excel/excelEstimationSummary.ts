// src/backend/services/estimation/export/excel/excelEstimationSummary.ts

import ExcelJS from 'exceljs'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackagesByEstimationId } from '@/backend/database/estimationPackageQueries'
import { getItemsByPackageId } from '@/backend/database/estimationItemQueries'
import { getQuotesByItemId } from '@/backend/database/estimationQuoteQueries'

import {
  formatDate,
  autoFitColumns,
  addMergedTitleRow,
  addSectionHeaderRow,
} from '../common/exportHelpers'

import type {
  EstimationItem,
  SupplierQuote,
} from '@/domain/estimations/estimationTypes'

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

type EstimationDetailRow = [
  string,
  string | number | null,
  string,
  string | number | null,
]

type EstimationSummaryContext = {
  estimation: EstimationRow
  packages: EstimationPackageRow[]
  packageItems: Record<number, EstimationItem[]>
  itemQuotes: Record<number, SupplierQuote[]>
}

const safeFormatDate = (
  value: string | number | Date | null | undefined,
): string => {
  if (!value) {
    return '-'
  }

  return formatDate(value)
}

export const generateEstimationExcelWorkbook = async (
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

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Estimation')

  buildEstimationSheet(sheet, ctx)

  autoFitColumns(sheet)

  return workbook
}

const buildEstimationSheet = (
  sheet: ExcelJS.Worksheet,
  ctx: EstimationSummaryContext,
): void => {
  const { estimation, packages, packageItems, itemQuotes } = ctx

  addTitleRow(sheet)
  sheet.addRow([])

  addEstimationDetailsSection(sheet, estimation)
  sheet.addRow([])

  addPackagesSection(sheet, packages, packageItems, itemQuotes)
}

const addTitleRow = (sheet: ExcelJS.Worksheet): void => {
  addMergedTitleRow(sheet, 'Estimation Report', 'H')
}

const addEstimationDetailsSection = (
  sheet: ExcelJS.Worksheet,
  estimation: EstimationRow,
): void => {
  addSectionHeaderRow(sheet, 'Estimation Details')

  const details: EstimationDetailRow[] = [
    ['Estimation ID', estimation.EstimationID, 'Project', estimation.ProjName],
    ['Title', estimation.EstimationTitle, 'Client', estimation.ClientName],
    [
      'Description',
      estimation.EstimationDescription || '-',
      'Status',
      estimation.Status,
    ],
    [
      'Currency',
      estimation.CurrencyCode || '-',
      'Total Cost',
      estimation.TotalCost ?? '-',
    ],
    [
      'Created By',
      estimation.CreatedByName || '-',
      'Created At',
      safeFormatDate(estimation.CreatedAt ?? null),
    ],
    [
      'Verified By',
      estimation.VerifiedByName || '-',
      'Date Verified',
      safeFormatDate(estimation.VerifiedAt),
    ],
    [
      'Approved By',
      estimation.ApprovedByName || '-',
      'Date Approved',
      safeFormatDate(estimation.ApprovedAt),
    ],
  ]

  for (const row of details) {
    sheet.addRow(row)
  }
}

const addPackagesSection = (
  sheet: ExcelJS.Worksheet,
  packages: EstimationPackageRow[],
  packageItems: Record<number, EstimationItem[]>,
  itemQuotes: Record<number, SupplierQuote[]>,
): void => {
  addSectionHeaderRow(sheet, 'Packages')

  for (const pkg of packages) {
    const itemsForPackage = packageItems[pkg.PackageID] ?? []
    addPackageBlock(sheet, pkg, itemsForPackage, itemQuotes)
  }
}

const addPackageBlock = (
  sheet: ExcelJS.Worksheet,
  pkg: EstimationPackageRow,
  itemsForPackage: EstimationItem[],
  itemQuotes: Record<number, SupplierQuote[]>,
): void => {
  sheet.addRow([])

  // Package header row
  sheet.addRow([
    `Package: ${pkg.PackageName}`,
    '',
    '',
    '',
    'Status',
    pkg.Status,
  ])

  // Package summary row
  sheet.addRow([
    'Description',
    pkg.PackageDescription || '-',
    'Created By',
    pkg.CreatedByName || '-',
    'Created At',
    safeFormatDate(pkg.CreatedAt ?? null),
  ])

  sheet.addRow([])

  // Items header
  sheet.addRow([
    'Item Name',
    'Quantity',
    'Description',
    'Created By',
    'Created At',
  ])

  for (const item of itemsForPackage) {
    addItemRowAndQuotes(sheet, item, itemQuotes[item.EItemID] ?? [])
  }
}

const addItemRowAndQuotes = (
  sheet: ExcelJS.Worksheet,
  item: EstimationItem,
  quotesForItem: SupplierQuote[],
): void => {
  sheet.addRow([
    item.ItemName,
    item.Quantity,
    item.Description || '-',
    item.CreatedByName || '-',
    safeFormatDate(item.CreatedAt ?? null),
  ])

  if (quotesForItem.length === 0) {
    return
  }

  sheet.addRow([])
  sheet.addRow(['', 'Supplier Quotes'])

  sheet.addRow([
    'Supplier',
    'Unit Cost',
    'Currency',
    'Delivery Days',
    'Notes',
    'Selected',
  ])

  for (const quote of quotesForItem) {
    sheet.addRow([
      quote.SupplierName,
      quote.QuotedUnitCost,
      quote.CurrencyCode,
      quote.ExpectedDeliveryDays,
      quote.Notes,
      quote.IsSelected ? 'Yes' : 'No',
    ])
  }
}

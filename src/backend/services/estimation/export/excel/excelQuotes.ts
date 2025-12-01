import ExcelJS from 'exceljs'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackageById } from '@/backend/database/estimationPackageQueries'
import { getItemsByPackageId } from '@/backend/database/estimationItemQueries'
import { getQuotesByItemId } from '@/backend/database/estimationQuoteQueries'

import {
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

type DetailRow = [string, string | number | null]

export const generateEstimationQuotesExcelWorkbook = async (
  itemId: number,
): Promise<ExcelJS.Workbook> => {
  // NOTE: This mirrors your existing behavior:
  // using getItemsByPackageId(itemId) and taking the first item.
  const itemList = await getItemsByPackageId(itemId) as EstimationItem[]

  if (!itemList || itemList.length === 0) {
    throw new Error('Item not found')
  }

  const item = itemList[0]

  const quotes = await getQuotesByItemId(
    itemId,
  ) as SupplierQuote[]

  const packageId = item.PackageID

  if (typeof packageId !== 'number') {
    throw new TypeError('Item.PackageID must be a number')
  }

  const packageData = await getPackageById(
    packageId,
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

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Supplier Quotes')

  buildQuotesSheet(sheet, {
    estimation,
    packageData,
    item,
    quotes,
  })

  autoFitColumns(sheet)

  return workbook
}

interface QuotesSheetContext {
  estimation: EstimationRow
  packageData: EstimationPackageRow
  item: EstimationItem
  quotes: SupplierQuote[]
}

const buildQuotesSheet = (
  sheet: ExcelJS.Worksheet,
  ctx: QuotesSheetContext,
): void => {
  const { estimation, packageData, item, quotes } = ctx

  // Title row
  addMergedTitleRow(sheet, 'Supplier Quotes', 'G')

  sheet.addRow([])

  // Details section
  addSectionHeaderRow(sheet, 'Estimation, Package & Item Details')

  const details: DetailRow[] = [
    ['Estimation ID', estimation.EstimationID],
    ['Estimation Title', estimation.EstimationTitle],
    ['Client', estimation.ClientName],
    ['Project', estimation.ProjName],
    ['Package ID', packageData.PackageID],
    ['Package Name', packageData.PackageName],
    ['Item ID', item.EItemID],
    ['Item Name', item.ItemName ?? '-'],
    ['Item Description', item.Description || '-'],
    ['Quantity', item.Quantity],
  ]

  for (const row of details) {
    sheet.addRow(row)
  }

  sheet.addRow([])

  // Quotes section
  addSectionHeaderRow(sheet, 'Supplier Quotes')

  sheet.addRow([
    'Quote ID',
    'Supplier',
    'Unit Cost',
    'Currency',
    'Delivery Days',
    'Notes',
    'Selected',
  ])

  for (const quote of quotes) {
    sheet.addRow([
      quote.QuoteID,
      quote.SupplierName,
      quote.QuotedUnitCost,
      quote.CurrencyCode,
      quote.ExpectedDeliveryDays,
      quote.Notes,
      quote.IsSelected ? 'Yes' : 'No',
    ])
  }
}

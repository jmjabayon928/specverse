// src/backend/services/estimation/export/excel/excelItems.ts

import ExcelJS from 'exceljs'

import { getEstimationById } from '@/backend/database/estimationQueries'
import { getPackageById } from '@/backend/database/estimationPackageQueries'
import { getItemsByPackageId } from '@/backend/database/estimationItemQueries'

import {
  formatDate,
  autoFitColumns,
  addMergedTitleRow,
  addSectionHeaderRow,
} from '../common/exportHelpers'

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

type DetailRow = [string, string | number | null]

export const generateEstimationItemsExcelWorkbook = async (
  packageId: number,
): Promise<ExcelJS.Workbook> => {
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

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Estimation Items')

  buildItemsSheet(sheet, {
    estimation,
    packageData,
    items,
  })

  autoFitColumns(sheet)

  return workbook
}

interface ItemsSheetContext {
  estimation: EstimationRow
  packageData: EstimationPackageRow
  items: EstimationItem[]
}

const buildItemsSheet = (
  sheet: ExcelJS.Worksheet,
  ctx: ItemsSheetContext,
): void => {
  const { estimation, packageData, items } = ctx

  // Title
  addMergedTitleRow(sheet, 'Estimation Items', 'F')

  sheet.addRow([])

  // Estimation & Package details section
  addSectionHeaderRow(sheet, 'Estimation & Package Details')

  const details: DetailRow[] = [
    ['Estimation ID', estimation.EstimationID],
    ['Estimation Title', estimation.EstimationTitle],
    ['Client', estimation.ClientName],
    ['Project', estimation.ProjName],
    ['Package ID', packageData.PackageID],
    ['Package Name', packageData.PackageName],
    ['Package Description', packageData.PackageDescription || '-'],
    ['Status', packageData.Status],
    ['Created By', packageData.CreatedByName || '-'],
    [
      'Created At',
      packageData.CreatedAt ? formatDate(packageData.CreatedAt) : '-',
    ],
  ]

  for (const row of details) {
    sheet.addRow(row)
  }

  sheet.addRow([])

  // Items section
  addSectionHeaderRow(sheet, 'Items')

  sheet.addRow([
    'Item ID',
    'Item Name',
    'Description',
    'Quantity',
    'Created By',
    'Created At',
  ])

  for (const item of items) {
    sheet.addRow([
      item.EItemID,
      item.ItemName,
      item.Description || '-',
      item.Quantity,
      item.CreatedByName || '-',
      item.CreatedAt ? formatDate(item.CreatedAt) : '-',
    ])
  }
}

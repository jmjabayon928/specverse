import ExcelJS from 'exceljs'

import { generateFilteredEstimationsPdf } from './pdf/pdfFilteredEstimations'
import { generateEstimationPdf } from './pdf/pdfEstimationSummary'
import { generateEstimationPackagesPdf } from './pdf/pdfPackages'
import { generateEstimationItemsPdf } from './pdf/pdfItems'
import { generateEstimationQuotesPdf } from './pdf/pdfQuotes'

import { generateEstimationExcelWorkbook } from './excel/excelEstimationSummary'
import { generateEstimationPackagesExcelWorkbook } from './excel/excelPackages'
import { generateEstimationItemsExcelWorkbook } from './excel/excelItems'
import { generateEstimationQuotesExcelWorkbook } from './excel/excelQuotes'

/**
 * PDF exports
 * -----------
 * Public API (new names):
 * - generateFilteredEstimationPDF(statuses, clients, projects, search)
 * - generateEstimationPDF(estimationId)
 * - generateEstimationPackagesPDF(estimationId)
 * - generateEstimationItemsPDF(packageId)
 * - generateEstimationQuotesPDF(itemId)
 */

export const generateFilteredEstimationPDF = async (
  statuses: string[],
  clients: number[],
  projects: number[],
  search: string,
): Promise<Buffer> => {
  return generateFilteredEstimationsPdf({
    statuses,
    clients,
    projects,
    search,
  })
}

export const generateEstimationPDF = async (
  estimationId: number,
): Promise<Buffer> => {
  return generateEstimationPdf(estimationId)
}

export const generateEstimationPackagesPDF = async (
  estimationId: number,
): Promise<Buffer> => {
  return generateEstimationPackagesPdf(estimationId)
}

export const generateEstimationItemsPDF = async (
  packageId: number,
): Promise<Buffer> => {
  return generateEstimationItemsPdf(packageId)
}

export const generateEstimationQuotesPDF = async (
  itemId: number,
): Promise<Buffer> => {
  return generateEstimationQuotesPdf(itemId)
}

/**
 * Backward-compatible PDF aliases
 * (so existing controllers keep working without refactor)
 */

export const generateEstimationSummaryPDF = async (
  estimationId: number,
): Promise<Buffer> => {
  return generateEstimationPDF(estimationId)
}

export const generatePackageProcurementPDF = async (
  estimationId: number,
): Promise<Buffer> => {
  return generateEstimationPackagesPDF(estimationId)
}

export const generateEstimationProcurementPDF = async (
  packageId: number,
): Promise<Buffer> => {
  return generateEstimationItemsPDF(packageId)
}

/**
 * Excel exports
 * -------------
 * Public API (new names):
 * - generateEstimationExcel(estimationId)
 * - generateEstimationPackagesExcel(estimationId)
 * - generateEstimationItemsExcel(packageId)
 * - generateEstimationQuotesExcel(itemId)
 *
 * Each excel/* module returns an ExcelJS.Workbook.
 * This file centralizes the conversion to Buffer.
 */

const workbookToBuffer = async (
  workbook: ExcelJS.Workbook,
): Promise<Buffer> => {
  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

export const generateEstimationExcel = async (
  estimationId: number,
): Promise<Buffer> => {
  const workbook = await generateEstimationExcelWorkbook(estimationId)
  return workbookToBuffer(workbook)
}

export const generateEstimationPackagesExcel = async (
  estimationId: number,
): Promise<Buffer> => {
  const workbook = await generateEstimationPackagesExcelWorkbook(estimationId)
  return workbookToBuffer(workbook)
}

export const generateEstimationItemsExcel = async (
  packageId: number,
): Promise<Buffer> => {
  const workbook = await generateEstimationItemsExcelWorkbook(packageId)
  return workbookToBuffer(workbook)
}

export const generateEstimationQuotesExcel = async (
  itemId: number,
): Promise<Buffer> => {
  const workbook = await generateEstimationQuotesExcelWorkbook(itemId)
  return workbookToBuffer(workbook)
}

/**
 * Backward-compatible Excel aliases
 * (match older controller import names)
 */

export const generateEstimationSummaryExcel = async (
  estimationId: number,
): Promise<Buffer> => {
  return generateEstimationExcel(estimationId)
}

export const generatePackageProcurementExcel = async (
  estimationId: number,
): Promise<Buffer> => {
  return generateEstimationPackagesExcel(estimationId)
}

export const generateEstimationProcurementExcel = async (
  packageId: number,
): Promise<Buffer> => {
  return generateEstimationItemsExcel(packageId)
}

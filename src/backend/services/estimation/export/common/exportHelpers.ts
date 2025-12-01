// src/backend/services/estimation/export/common/exportHelpers.ts

import type { CellValue, Worksheet } from 'exceljs'

/**
 * Safely format a date-like value as a localized date string (YYYY-MM-DD style depends on locale).
 * Returns '-' for nullish / invalid values.
 */
export const formatDate = (value?: string | number | Date | null): string => {
  if (!value) {
    return '-'
  }

  const date = value instanceof Date ? value : new Date(value)
  // Guard against invalid Date (NaN)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleDateString()
}

/**
 * Convert any cell value into a readable string for width calculations.
 */
const cellValueToString = (value: CellValue | null | undefined): string => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return value.toString()
  }

  if (value instanceof Date) {
    return formatDate(value)
  }

  // Rich text, formulas, hyperlinks, etc. – ExcelJS types
  if (typeof value === 'object') {
    // Fallback to JSON for complex structures
    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }

  return ''
}

export interface AutoFitColumnsOptions {
  /**
   * Minimum column width (in Excel character units). Default: 15.
   */
  minWidth?: number
  /**
   * Maximum column width (in Excel character units). Default: 50.
   */
  maxWidth?: number
  /**
   * Extra padding characters to add to the measured length. Default: 2.
   */
  padding?: number
}

/**
 * Auto-fit all columns in a worksheet based on the longest cell text.
 *
 * This is a convenience helper so each export function doesn't repeat
 * the same sizing logic.
 */
export const autoFitColumns = (
  sheet: Worksheet,
  options?: AutoFitColumnsOptions,
): void => {
  const minWidth = options?.minWidth ?? 15
  const maxWidth = options?.maxWidth ?? 50
  const padding = options?.padding ?? 2

  for (const column of sheet.columns) {
    if (!column) {
      continue
    }

    const eachCell = column.eachCell?.bind(column)
    if (!eachCell) {
      continue
    }

    let maxLength = 0

    eachCell({ includeEmpty: true }, cell => {
      const text = cellValueToString(cell.value)
      if (text.length > maxLength) {
        maxLength = text.length
      }
    })

    const calculated = maxLength + padding
    const width = Math.min(Math.max(calculated, minWidth), maxWidth)

    column.width = width
  }
}

/**
 * Helper to add a merged title row (e.g., "Estimation Report") with
 * centered, bold, larger text.
 *
 * Returns the row index of the created title row.
 */
export const addMergedTitleRow = (
  sheet: Worksheet,
  title: string,
  lastColumnLetter: string,
): number => {
  const titleRowIndex = sheet.rowCount + 1
  const titleCellAddress = `A${titleRowIndex}`
  const mergeRange = `A${titleRowIndex}:${lastColumnLetter}${titleRowIndex}`

  const row = sheet.addRow([title])
  sheet.mergeCells(mergeRange)

  const cell = sheet.getCell(titleCellAddress)
  cell.font = {
    bold: true,
    size: 16,
  }
  cell.alignment = {
    horizontal: 'center',
    vertical: 'middle',
  }

  return row.number
}

/**
 * Helper to add a simple section header row (e.g., "Estimation Details")
 * with bold font. Returns the row index.
 */
export const addSectionHeaderRow = (
  sheet: Worksheet,
  label: string,
): number => {
  const row = sheet.addRow([label])
  const cell = row.getCell(1)

  cell.font = {
    bold: true,
  }

  return row.number
}

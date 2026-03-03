// src/backend/utils/fileParser.ts
import ExcelJS from 'exceljs'
import fs from 'fs/promises'
import path from 'path'

export interface ParsedRow {
  rowIndex: number
  data: Record<string, string | null>
}

export interface ParseFileResult {
  rows: ParsedRow[]
  headers: string[]
}

const ALLOWED_EXTENSIONS = ['.xlsx', '.csv'] as const
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_ROW_COUNT = 2000
const MAX_SOURCE_VALUE_LENGTH = 2000 // Truncate stored values to this length

/**
 * Validate file type and size
 */
export function validateFile(filePath: string, fileSize: number): void {
  const ext = path.extname(filePath).toLowerCase()
  
  if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
    throw new Error(`Unsupported file format: ${ext}. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }
  
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`)
  }
}

/**
 * Parse Excel (.xlsx) or CSV file into rows with headers
 * Enforces row count limit
 */
export async function parseFile(filePath: string): Promise<ParseFileResult> {
  const ext = path.extname(filePath).toLowerCase()
  
  if (ext === '.xlsx') {
    return parseExcelFile(filePath)
  } else if (ext === '.csv') {
    return parseCsvFile(filePath)
  } else {
    throw new Error(`Unsupported file format: ${ext}. Supported: ${ALLOWED_EXTENSIONS.join(', ')}`)
  }
}

/**
 * Truncate string value to safe length for storage
 */
export function truncateSourceValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null
  const str = String(value)
  if (str.length <= MAX_SOURCE_VALUE_LENGTH) return str
  return str.substring(0, MAX_SOURCE_VALUE_LENGTH) + '... [truncated]'
}

async function parseExcelFile(filePath: string): Promise<ParseFileResult> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)
  
  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('Excel file has no worksheets')
  }

  const headers: string[] = []
  const firstRow = worksheet.getRow(1)
  firstRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = String(cell.value ?? '').trim()
    if (header) {
      headers[colNumber - 1] = header
    }
  })

  // Fill gaps in headers array
  for (let i = 0; i < headers.length; i++) {
    if (!headers[i]) {
      headers[i] = `Column${i + 1}`
    }
  }

  const rows: ParsedRow[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return // Skip header row
    
    // Enforce row count limit
    if (rows.length >= MAX_ROW_COUNT) {
      return // Stop parsing
    }
    
    const data: Record<string, string | null> = {}
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1]
      if (header) {
        const value = cell.value
        if (value === null || value === undefined) {
          data[header] = null
        } else if (typeof value === 'object' && 'text' in value) {
          data[header] = String((value as { text: string }).text).trim() || null
        } else {
          data[header] = String(value).trim() || null
        }
      }
    })
    
    // Only add row if it has at least one non-empty value
    if (Object.values(data).some(v => v !== null && v !== '')) {
      rows.push({ rowIndex: rowNumber, data })
    }
  })

  if (rows.length >= MAX_ROW_COUNT) {
    throw new Error(`Row count exceeds maximum allowed rows of ${MAX_ROW_COUNT}`)
  }

  return { rows, headers }
}

async function parseCsvFile(filePath: string): Promise<ParseFileResult> {
  const content = await fs.readFile(filePath, 'utf-8')
  const lines = content.split(/\r?\n/).filter(line => line.trim())
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty')
  }

  // Parse header
  const headerLine = lines[0]
  const headers = parseCsvLine(headerLine).map(h => h.trim())

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    // Enforce row count limit
    if (rows.length >= MAX_ROW_COUNT) {
      break
    }
    
    const values = parseCsvLine(lines[i])
    const data: Record<string, string | null> = {}
    
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j] || `Column${j + 1}`
      const value = values[j]?.trim() || null
      data[header] = value === '' ? null : value
    }
    
    // Only add row if it has at least one non-empty value
    if (Object.values(data).some(v => v !== null && v !== '')) {
      rows.push({ rowIndex: i + 1, data })
    }
  }

  if (rows.length >= MAX_ROW_COUNT) {
    throw new Error(`Row count exceeds maximum allowed rows of ${MAX_ROW_COUNT}`)
  }

  return { rows, headers }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  
  // Add last field
  values.push(current)
  
  return values
}

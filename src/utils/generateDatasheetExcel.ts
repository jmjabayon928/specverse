// src/utils/generateDatasheetExcel.ts

import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'
import { getLabel } from '@/utils/translationUtils'
import { translations } from '@/constants/translations'
import { convertToUSC } from '@/utils/unitConversionTable'
import { fetchSheetLogsMerged } from '@/backend/services/sheetLogsService'

type DetailRow = [
  string,
  string | number | null | undefined,
  string,
  string | number | null | undefined,
]

const uiMapCache = new Map<string, Record<string, string>>()

const getUiMapForLang = (lang: string): Record<string, string> => {
  const cached = uiMapCache.get(lang)
  if (cached) {
    return cached
  }

  const map = Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [
      key,
      value[lang] ?? key,
    ])
  )

  uiMapCache.set(lang, map)
  return map
}

const addDetailSection = (
  sheet1: ExcelJS.Worksheet,
  startRowIndex: number,
  title: string,
  rows: DetailRow[],
  labelStyle: Partial<ExcelJS.Style>,
  valueStyle: Partial<ExcelJS.Style>,
  uiMap: Record<string, string>
): number => {
  let rowIndex = startRowIndex

  const headerRow = sheet1.getRow(rowIndex++)
  headerRow.getCell('A').value = title
  headerRow.getCell('A').font = { size: 12, bold: true }
  sheet1.mergeCells(`A${headerRow.number}:B${headerRow.number}`)

  for (const [label1, value1, label2, value2] of rows) {
    const row = sheet1.getRow(rowIndex++)
    row.getCell('A').value = getLabel(label1, uiMap)
    row.getCell('A').style = labelStyle
    sheet1.mergeCells(`A${row.number}:B${row.number}`)

    row.getCell('C').value = value1 ?? '-'
    row.getCell('C').style = valueStyle
    sheet1.mergeCells(`C${row.number}:D${row.number}`)

    row.getCell('E').value = getLabel(label2, uiMap)
    row.getCell('E').style = labelStyle
    sheet1.mergeCells(`E${row.number}:F${row.number}`)

    row.getCell('G').value = value2 ?? '-'
    row.getCell('G').style = valueStyle
    sheet1.mergeCells(`G${row.number}:H${row.number}`)
  }

  return rowIndex
}

const addSpacerRow = (
  sheet1: ExcelJS.Worksheet,
  startRowIndex: number
): number => {
  const spacerRow = sheet1.getRow(startRowIndex)
  sheet1.mergeCells(`A${spacerRow.number}:H${spacerRow.number}`)
  return startRowIndex + 1
}

const addSubsheetTable = (
  sheet1: ExcelJS.Worksheet,
  startRowIndex: number,
  subsheet: UnifiedSheet['subsheets'][number],
  labelStyle: Partial<ExcelJS.Style>,
  valueStyle: Partial<ExcelJS.Style>,
  uiMap: Record<string, string>,
  isUSC: boolean
): number => {
  let rowIndex = startRowIndex

  const emptyRow = sheet1.getRow(rowIndex++)
  sheet1.mergeCells(`A${emptyRow.number}:H${emptyRow.number}`)

  const header = sheet1.getRow(rowIndex++)
  header.getCell('A').value = getLabel(subsheet.name, uiMap)
  header.getCell('A').font = { size: 12, bold: true }
  sheet1.mergeCells(`A${header.number}:H${header.number}`)

  const tableHeader = sheet1.getRow(rowIndex++)
  tableHeader.getCell('A').value = getLabel('label', uiMap)
  tableHeader.getCell('C').value = getLabel('options', uiMap)
  tableHeader.getCell('E').value = getLabel('value', uiMap)
  tableHeader.getCell('G').value = getLabel('uom', uiMap)
  sheet1.mergeCells(`A${tableHeader.number}:B${tableHeader.number}`)
  sheet1.mergeCells(`C${tableHeader.number}:D${tableHeader.number}`)
  sheet1.mergeCells(`E${tableHeader.number}:F${tableHeader.number}`)
  sheet1.mergeCells(`G${tableHeader.number}:H${tableHeader.number}`)

  tableHeader.getCell('A').style = labelStyle
  tableHeader.getCell('C').style = labelStyle
  tableHeader.getCell('E').style = labelStyle
  tableHeader.getCell('G').style = labelStyle

  for (const field of subsheet.fields) {
    const row = sheet1.getRow(rowIndex++)
    row.getCell('A').value = getLabel(field.label, uiMap)
    row.getCell('A').style = labelStyle
    sheet1.mergeCells(`A${row.number}:B${row.number}`)

    row.getCell('C').value = field.options?.join(', ') ?? '-'
    row.getCell('C').style = valueStyle
    sheet1.mergeCells(`C${row.number}:D${row.number}`)

    let displayValue: string | number | null = field.value ?? '-'
    let displayUom = field.uom ?? '-'

    if (isUSC && field.uom) {
      if (field.value !== null && field.value !== undefined && field.value !== '') {
        const converted = convertToUSC(String(field.value), field.uom)
        displayValue = converted?.value ?? field.value
        displayUom = converted?.unit ?? field.uom
      } else {
        const converted = convertToUSC('0', field.uom)
        displayUom = converted?.unit ?? field.uom
        displayValue = '-'
      }
    }

    row.getCell('E').value = displayValue
    row.getCell('E').style = valueStyle
    sheet1.mergeCells(`E${row.number}:F${row.number}`)

    row.getCell('G').value = displayUom
    row.getCell('G').style = valueStyle
    sheet1.mergeCells(`G${row.number}:H${row.number}`)
  }

  return rowIndex
}

const cleanForFileName = (
  value: string | number | null | undefined
): string => {
  return String(value ?? '')
    .replaceAll(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replaceAll(/\s+/g, '_')
}

export interface DatasheetExcelResult {
  buffer: Buffer
  fileName: string
}

type LogEntry = {
  id: number
  kind: 'audit' | 'change'
  sheetId: number
  action: string
  user: { id: number | null; name: string }
  timestamp: string
  details: Record<string, unknown>
}

export const generateDatasheetExcel = async (
  sheet: UnifiedSheet,
  lang: string,
  uom: 'SI' | 'USC'
): Promise<DatasheetExcelResult> => {
  const sheetType = sheet.isTemplate ? 'Template' : 'FilledSheet'
  const fileName = `${cleanForFileName(sheetType)}-${cleanForFileName(
    sheet.clientName
  )}-${cleanForFileName(
    sheet.sheetName
  )}-RevNo-${cleanForFileName(sheet.revisionNum)}-${uom}-${lang}.xlsx`

  const isUSC = uom === 'USC'

  const workbook = new ExcelJS.Workbook()
  const sheet1 = workbook.addWorksheet('Datasheet', {
    views: [{ state: 'frozen', ySplit: 0 }],
  })
  sheet1.properties.defaultColWidth = 15

  const labelStyle: Partial<ExcelJS.Style> = {
    font: { size: 10, bold: true },
    alignment: {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  }

  const valueStyle: Partial<ExcelJS.Style> = {
    font: { size: 10 },
    alignment: {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    },
    border: {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    },
  }

  const uiMap = getUiMapForLang(lang)

  sheet1.columns = new Array(8).fill({ width: 15 })

  try {
    const logoPath = path.resolve(
      `./public/clients/${sheet.clientLogo ?? ''}`
    )

    if (fs.existsSync(logoPath)) {
      const imageExt = path
        .extname(logoPath)
        .substring(1)
        .toLowerCase() as 'png' | 'jpeg'

      const imageId = workbook.addImage({
        buffer: fs.readFileSync(logoPath) as unknown as ExcelJS.Buffer,
        extension: imageExt,
      })

      sheet1.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 120, height: 60 },
      })
    }
  } catch (error) {
    console.error('Error inserting logo:', error)
  }

  sheet1.mergeCells('C1:H1')
  sheet1.mergeCells('C2:H2')
  sheet1.mergeCells('C3:H3')
  sheet1.mergeCells('C4:H4')

  sheet1.getCell('C1').value = `${getLabel(
    sheet.status ?? '',
    uiMap
  )} – ${sheet.sheetName ?? ''}`
  sheet1.getCell('C1').font = { size: 12, bold: true }
  sheet1.getCell('C1').alignment = {
    vertical: 'middle',
    horizontal: 'left',
  }

  sheet1.getCell('C2').value = sheet.sheetDesc ?? ''
  sheet1.getCell('C2').font = { size: 11, bold: true }
  sheet1.getCell('C2').alignment = {
    vertical: 'middle',
    horizontal: 'left',
  }

  sheet1.getCell('C3').value = sheet.sheetDesc2 ?? ''
  sheet1.getCell('C3').font = { size: 10 }
  sheet1.getCell('C3').alignment = {
    vertical: 'middle',
    horizontal: 'left',
  }

  let rowIndex = 6

  rowIndex = addDetailSection(
    sheet1,
    rowIndex,
    getLabel('Datasheet Details', uiMap),
    [
      ['sheetName', sheet.sheetName, 'sheetDesc', sheet.sheetDesc],
      ['sheetDesc2', sheet.sheetDesc2, 'clientDocNum', sheet.clientDocNum],
      [
        'clientProjectNum',
        sheet.clientProjectNum,
        'companyDocNum',
        sheet.companyDocNum,
      ],
      [
        'companyProjectNum',
        sheet.companyProjectNum,
        'areaName',
        sheet.areaName,
      ],
      ['packageName', sheet.packageName, 'revisionNum', sheet.revisionNum],
      [
        'revisionDate',
        sheet.revisionDate,
        'preparedByName',
        sheet.preparedByName,
      ],
      [
        'preparedByDate',
        sheet.preparedByDate,
        'modifiedByName',
        sheet.modifiedByName,
      ],
      [
        'modifiedByDate',
        sheet.modifiedByDate,
        'rejectedByName',
        sheet.rejectedByName,
      ],
      [
        'rejectedByDate',
        sheet.rejectedByDate,
        'rejectComment',
        sheet.rejectComment,
      ],
      [
        'verifiedByName',
        sheet.verifiedByName,
        'verifiedByDate',
        sheet.verifiedDate,
      ],
      [
        'approvedByName',
        sheet.approvedByName,
        'approvedByDate',
        sheet.approvedDate,
      ],
    ],
    labelStyle,
    valueStyle,
    uiMap
  )

  rowIndex = addSpacerRow(sheet1, rowIndex)

  rowIndex = addDetailSection(
    sheet1,
    rowIndex,
    getLabel('Equipment Details', uiMap),
    [
      [
        'equipmentName',
        sheet.equipmentName,
        'equipmentTagNum',
        sheet.equipmentTagNum,
      ],
      ['serviceName', sheet.serviceName, 'requiredQty', sheet.requiredQty],
      ['itemLocation', sheet.itemLocation, 'manuName', sheet.manuName],
      ['suppName', sheet.suppName, 'installPackNum', sheet.installPackNum],
      ['equipSize', sheet.equipSize, 'modelNum', sheet.modelNum],
      ['driver', sheet.driver, 'pid', sheet.pid],
      ['installDWG', sheet.installDwg, 'codeStandard', sheet.codeStd],
      ['categoryName', sheet.categoryName, 'clientName', sheet.clientName],
      ['projectName', sheet.projectName, '', ''],
    ],
    labelStyle,
    valueStyle,
    uiMap
  )

  for (const subsheet of sheet.subsheets) {
    rowIndex = addSubsheetTable(
      sheet1,
      rowIndex,
      subsheet,
      labelStyle,
      valueStyle,
      uiMap,
      isUSC
    )
  }

  const logs =
    typeof sheet.sheetId === 'number'
      ? await fetchSheetLogsMerged(sheet.sheetId, 50)
      : []

  const auditSheet = workbook.addWorksheet('Audit Log')
  auditSheet.columns = [
    { header: 'Timestamp', key: 'timestamp', width: 28 },
    { header: 'Action', key: 'action', width: 60 },
    { header: 'User', key: 'user', width: 28 },
  ]

  auditSheet.getRow(1).font = { bold: true }

  for (const log of (logs as LogEntry[]).slice(0, 50)) {
    auditSheet.addRow({
      timestamp: log.timestamp,
      action: log.action,
      user: log.user?.name ?? 'Unknown',
    })
  }

  sheet1.headerFooter.oddFooter =
    '&CGenerated by SpecVerse | © Jeff Martin Abayon, 2025 | www.github.com/jmjabayon928/specverse'

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer: Buffer.from(buffer),
    fileName,
  }
}

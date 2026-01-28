// src/utils/generateDatasheetPDF.ts

import puppeteer from 'puppeteer'
import fs from 'node:fs'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { convertToUSC } from '@/utils/unitConversionTable'
import { getLabel } from '@/utils/translationUtils'
import { translations } from '@/constants/translations'
import type { UnifiedSheet, UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'
import { fetchSheetLogsMerged } from '@/backend/services/sheetLogsService'

export interface DatasheetPDFResult {
  buffer: Buffer
  fileName: string
}

type UiMap = Record<string, string>

const uiMapCache = new Map<string, UiMap>()

const getUiMapForLang = (lang: string): UiMap => {
  const cached = uiMapCache.get(lang)
  if (cached) {
    return cached
  }

  const map: UiMap = Object.fromEntries(
    Object.entries(translations).map(([key, value]) => [
      key,
      value[lang] ?? key,
    ])
  )

  uiMapCache.set(lang, map)
  return map
}

const cleanForFileName = (
  value: string | number | null | undefined
): string => {
  return String(value ?? '')
    .replaceAll(/[/\\?%*:|"<>]/g, '')
    .trim()
    .replaceAll(/\s+/g, '_')
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

function escapeHtml(input: unknown): string {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function truncateText(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input
  return `${input.slice(0, Math.max(0, maxLen - 1))}…`
}

const buildAuditLogSectionHtml = (logs: LogEntry[]): string => {
  const rows = logs
    .slice(0, 50)
    .map((log) => {
      const date = escapeHtml(log.timestamp)
      const action = escapeHtml(truncateText(log.action, 180))
      const user = escapeHtml(log.user?.name ?? 'Unknown')

      return `
        <tr class="audit-row">
          <td class="audit-date">${date}</td>
          <td class="audit-action" title="${escapeHtml(log.action)}">${action}</td>
          <td class="audit-user">${user}</td>
        </tr>
      `
    })
    .join('')

  if (!rows) {
    return `
      <h2 class="section-title">Audit &amp; Change Log</h2>
      <div class="audit-empty">No audit logs available.</div>
    `
  }

  return `
    <div class="audit-section">
      <h2 class="section-title">Audit &amp; Change Log</h2>
      <table class="audit-table" style="width:100%; border-collapse: collapse;" border="1">
        <thead class="table-header">
          <tr style="background-color:#f2f2f2;">
            <th style="width: 22%;">Date</th>
            <th style="width: 56%;">Action</th>
            <th style="width: 22%;">Performed By</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}

const buildSubsheetTableHtml = (
  subsheet: UnifiedSubsheet,
  isUSC: boolean,
  getUI: (key: string) => string
): string => {
  const rows = subsheet.fields
    .map((field) => {
      const label = field.label
      const requiredStar = field.required
        ? " <span style='color:red'>*</span>"
        : ''
      const options = field.options?.join(', ') ?? ''

      let uomLabel = field.uom ?? ''
      let value: string | number | null = field.value ?? ''

      if (isUSC && field.uom) {
        if (field.value !== null && field.value !== undefined && field.value !== '') {
          const converted = convertToUSC(String(field.value), field.uom)
          value = converted?.value ?? field.value
          uomLabel = converted?.unit ?? field.uom
        } else {
          const converted = convertToUSC('0', field.uom)
          uomLabel = converted?.unit ?? field.uom
          value = ''
        }
      }

      return `
          <tr class="table-body">
            <td>${label}${requiredStar}</td>
            <td>${uomLabel}</td>
            <td>${options}</td>
            <td>${value ?? ''}</td>
          </tr>
        `
    })
    .join('')

  return `
      <div class="section-title">${subsheet.name}</div>
      <table style="width:100%; border-collapse: collapse;" border="1">
        <thead class="table-header">
          <tr style="background-color:#f2f2f2;">
            <th>${getUI('InfoLabel')}</th>
            <th>${getUI('InfoUOM')}</th>
            <th>${getUI('InfoOptions')}</th>
            <th>${getUI('InfoValue')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
}

const buildDetailSectionHtml = (title: string, rowsHtml: string): string => {
  return `
      <h2 class="section-title">${title}</h2>
      <table class="data-table" style="width:100%; border-collapse: collapse;" border="1">
        ${rowsHtml}
      </table>
    `
}

export const generateDatasheetPDF = async (
  sheet: UnifiedSheet,
  lang: string,
  uom: 'SI' | 'USC'
): Promise<DatasheetPDFResult> => {
  const sheetType = sheet.isTemplate ? 'Template' : 'FilledSheet'

  const fileName = `${cleanForFileName(sheetType)}-${cleanForFileName(
    sheet.clientName
  )}-${cleanForFileName(
    sheet.sheetName
  )}-RevNo-${cleanForFileName(sheet.revisionNum)}-${uom}-${lang}.pdf`

  const uiMap = getUiMapForLang(lang)
  const getUI = (key: string): string => getLabel(key, uiMap)
  const isUSC = uom === 'USC'

  const logoFileName = sheet.clientLogo ?? ''
  const logoPath = path.resolve(`public/clients/${logoFileName}`)
  const logoExt = path.extname(logoFileName).replace('.', '') || 'png'

  let logoBase64 = ''
  if (logoFileName && fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString('base64')
  }

  const translatedStatus =
    translations[sheet.status as keyof typeof translations]?.[lang] ??
    sheet.status ??
    'Draft'

  const subsheetTablesHtml = sheet.subsheets
    .map((subsheet) => buildSubsheetTableHtml(subsheet, isUSC, getUI))
    .join('')

  const logs =
    typeof sheet.sheetId === 'number'
      ? await fetchSheetLogsMerged(sheet.sheetId, 50)
      : []
  const auditLogSectionHtml = buildAuditLogSectionHtml(logs as LogEntry[])

  const datasheetDetailsRowsHtml = `
    <tr class="data-row">
      <td class="label">${getUI('sheetName')}</td><td class="value">${sheet.sheetName ?? ''}</td>
      <td class="label">${getUI('sheetDesc')}</td><td class="value">${sheet.sheetDesc ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('sheetDesc2')}</td><td class="value">${sheet.sheetDesc2 ?? ''}</td>
      <td class="label">${getUI('clientDocNum')}</td><td class="value">${sheet.clientDocNum ?? '-'}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('clientProjectNum')}</td><td class="value">${sheet.clientProjectNum ?? '-'}</td>
      <td class="label">${getUI('companyDocNum')}</td><td class="value">${sheet.companyDocNum ?? '-'}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('companyProjectNum')}</td><td class="value">${sheet.companyProjectNum ?? '-'}</td>
      <td class="label">${getUI('areaName')}</td><td class="value">${sheet.areaName ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('packageName')}</td><td class="value">${sheet.packageName ?? ''}</td>
      <td class="label">${getUI('revisionNum')}</td><td class="value">${sheet.revisionNum ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('revisionDate')}</td><td class="value">${sheet.revisionDate ?? ''}</td>
      <td class="label">${getUI('preparedByName')}</td><td class="value">${sheet.preparedByName ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('preparedByDate')}</td><td class="value">${sheet.preparedByDate ?? ''}</td>
      <td class="label">${getUI('modifiedByName')}</td><td class="value">${sheet.modifiedByName ?? '-'}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('modifiedByDate')}</td><td class="value">${sheet.modifiedByDate ?? '-'}</td>
      <td class="label">${getUI('rejectedByName')}</td><td class="value">${sheet.rejectedByName ?? '-'}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('rejectedByDate')}</td><td class="value">${sheet.rejectedByDate ?? '-'}</td>
      <td class="label">${getUI('rejectComment')}</td><td class="value">${sheet.rejectComment ?? '-'}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('verifiedByName')}</td><td class="value">${sheet.verifiedByName ?? ''}</td>
      <td class="label">${getUI('verifiedByDate')}</td><td class="value">${sheet.verifiedDate ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('approvedByName')}</td><td class="value">${sheet.approvedByName ?? ''}</td>
      <td class="label">${getUI('approvedByDate')}</td><td class="value">${sheet.approvedDate ?? ''}</td>
    </tr>
  `

  const equipmentDetailsRowsHtml = `
    <tr class="data-row">
      <td class="label">${getUI('equipmentName')}</td><td class="value">${sheet.equipmentName ?? ''}</td>
      <td class="label">${getUI('equipmentTagNum')}</td><td class="value">${sheet.equipmentTagNum ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('serviceName')}</td><td class="value">${sheet.serviceName ?? ''}</td>
      <td class="label">${getUI('requiredQty')}</td><td class="value">${sheet.requiredQty ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('itemLocation')}</td><td class="value">${sheet.itemLocation ?? ''}</td>
      <td class="label">${getUI('manuName')}</td><td class="value">${sheet.manuName ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('suppName')}</td><td class="value">${sheet.suppName ?? ''}</td>
      <td class="label">${getUI('installPackNum')}</td><td class="value">${sheet.installPackNum ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('equipSize')}</td><td class="value">${sheet.equipSize ?? ''}</td>
      <td class="label">${getUI('modelNum')}</td><td class="value">${sheet.modelNum ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('driver')}</td><td class="value">${sheet.driver ?? '-'}</td>
      <td class="label">${getUI('pid')}</td><td class="value">${sheet.pid ?? '-'}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('installDWG')}</td><td class="value">${sheet.installDwg ?? '-'}</td>
      <td class="label">${getUI('codeStd')}</td><td class="value">${sheet.codeStd ?? '-'}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('categoryName')}</td><td class="value">${sheet.categoryName ?? ''}</td>
      <td class="label">${getUI('clientName')}</td><td class="value">${sheet.clientName ?? ''}</td>
    </tr>
    <tr class="data-row">
      <td class="label">${getUI('projectName')}</td><td class="value">${sheet.projectName ?? ''}</td>
      <td class="label"></td>
    </tr>
  `

  const datasheetDetailsSectionHtml = buildDetailSectionHtml(
    getUI('Datasheet Details'),
    datasheetDetailsRowsHtml
  )

  const equipmentDetailsSectionHtml = buildDetailSectionHtml(
    getUI('Equipment Details'),
    equipmentDetailsRowsHtml
  )

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1, h2, h3 { margin: 0; padding: 0; color: #333; }
        table { margin-bottom: 30px; }
        th, td { padding: 8px; text-align: left; }
        .header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 30px; }
        .logo { width: 96px; height: 96px; object-fit: contain; }
        .sheet-meta h1 { font-size: 12px; font-weight: bold; color: #1f2937; }
        .sheet-meta h2 { font-size: 11px; font-weight: bold; color: #374151; margin-top: 4px; }
        .sheet-meta h3 { font-size: 10px; font-weight: normal; color: #4b5563; margin-top: 4px; }
        .section-title { font-size: 12px; font-weight: bold; margin-top: 20px; }
        .data-table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
        .data-row td.label { font-size: 10px; font-weight: normal; width: 25%; }
        .data-row td.value { font-size: 10px; font-weight: bold; width: 25%; }
        .table-header th { font-size: 11px; font-weight: bold; }
        .table-body td { font-size: 10px; font-weight: normal; }
        .audit-section { break-inside: avoid; page-break-inside: avoid; }
        .audit-table th { font-size: 10px; font-weight: bold; }
        .audit-table td { font-size: 9px; font-weight: normal; }
        .audit-action { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 360px; }
        .audit-empty { font-size: 10px; color: #4b5563; margin-top: 8px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${
          logoBase64
            ? `<img src="data:image/${logoExt};base64,${logoBase64}" class="logo" alt="Client Logo" />`
            : '<!-- Logo not found -->'
        }
        <div class="sheet-meta">
          <h1>${translatedStatus} – ${sheet.sheetName}</h1>
          <h2>${sheet.sheetDesc ?? ''}</h2>
          <h3>${sheet.sheetDesc2 ?? ''}</h3>
        </div>
      </div>

      ${datasheetDetailsSectionHtml}

      ${equipmentDetailsSectionHtml}

      ${subsheetTablesHtml}

      ${auditLogSectionHtml}
      
      <div style="font-size:9px; text-align:center; color:#6b7280; margin-top:40px; border-top:1px solid #ccc; padding-top:10px;">
        Generated by <strong>SpecVerse</strong> | © Jeff Martin Abayon, 2025 |
        <a href="https://github.com/jmjabayon928/specverse" target="_blank" style="color:#2563eb;">www.github.com/jmjabayon928/specverse</a>
      </div>

    </body>
    </html>
  `

  const launchBrowser = async (): Promise<import('puppeteer').Browser> => {
    try {
      return await puppeteer.launch({ headless: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const isMissingChrome =
        msg.includes('Could not find Chrome') || msg.includes('resolveExecutablePath')

      // Local-dev friendly fallback: use system-installed Chrome if Puppeteer-managed
      // browser binaries are missing/not installed.
      if (isMissingChrome) {
        return await puppeteer.launch({ headless: true, channel: 'chrome' })
      }

      throw err
    }
  }

  const browser = await launchBrowser()
  const page = await browser.newPage()

  await page.setContent(htmlContent, { waitUntil: 'networkidle0' })

  const pdfBuffer: Uint8Array = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '7mm', right: '7mm' },
  })

  await browser.close()

  return {
    buffer: Buffer.from(pdfBuffer),
    fileName,
  }
}

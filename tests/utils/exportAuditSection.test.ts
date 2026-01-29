/** @jest-environment node */
import ExcelJS from 'exceljs'
import { generateDatasheetPDF } from '@/utils/generateDatasheetPDF'
import { generateDatasheetExcel } from '@/utils/generateDatasheetExcel'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'

jest.setTimeout(60000)

jest.mock('../../src/backend/config/db', () => {
  const MockTransaction = class {
    begin = () => Promise.resolve()
    commit = () => Promise.resolve()
    rollback = () => Promise.resolve()
  }
  return {
    poolPromise: Promise.resolve({}),
    sql: {
      Transaction: MockTransaction,
      Int: 1,
      NVarChar: (n: number) => n,
      MAX: 9999,
    },
  }
})

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: jest.fn().mockResolvedValue(undefined),
  getAuditLogsForRecord: jest.fn().mockResolvedValue([]),
}))

jest.mock('../../src/backend/database/changeLogQueries', () => ({
  getChangeLogsForSheet: jest.fn().mockResolvedValue([]),
}))

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn().mockResolvedValue({
      newPage: jest.fn().mockResolvedValue({
        setContent: jest.fn().mockResolvedValue(undefined),
        pdf: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }),
  },
}))

jest.mock('@/backend/services/sheetLogsService', () => ({
  fetchSheetLogsMerged: jest.fn().mockResolvedValue([
    {
      id: 1,
      kind: 'audit',
      sheetId: 123,
      action: 'Update Filled Sheet',
      user: { id: 7, name: 'Jane Doe' },
      timestamp: '2026-01-28T19:04:22.123Z',
      details: { route: '/api/backend/filledsheets/123', method: 'PUT' },
    },
    {
      id: 2,
      kind: 'change',
      sheetId: 123,
      action: 'Field updated: Length (10 → 12)',
      user: { id: 7, name: 'Jane Doe' },
      timestamp: '2026-01-28T19:04:10.000Z',
      details: { fieldLabel: 'Length', oldValue: '10', newValue: '12' },
    },
  ]),
}))

describe('Export Audit Trail sections', () => {
  it('generates a PDF buffer with audit section without error', async () => {
    const sheet = {
      sheetId: 123,
      isTemplate: false,
      status: 'Draft',
      clientName: 'Client',
      sheetName: 'Test Sheet',
      revisionNum: 1,
      clientLogo: 'nonexistent.png',
      sheetDesc: '',
      sheetDesc2: '',
      subsheets: [
        {
          id: 1,
          name: 'Subsheet 1',
          fields: [
            {
              id: 1,
              label: 'Length',
              infoType: 'varchar',
              uom: 'm',
              required: false,
              sortOrder: 1,
              options: [],
              value: '10',
            },
          ],
        },
      ],
    } as unknown as UnifiedSheet

    const result = await generateDatasheetPDF(sheet, 'eng', 'SI')
    expect(result.buffer).toBeInstanceOf(Buffer)
    expect(result.buffer.length).toBeGreaterThan(0)
  })

  it('generates an Excel workbook that includes an Audit Log worksheet', async () => {
    const sheet = {
      sheetId: 123,
      isTemplate: false,
      status: 'Draft',
      clientName: 'Client',
      sheetName: 'Test Sheet',
      revisionNum: 1,
      clientLogo: 'nonexistent.png',
      sheetDesc: '',
      sheetDesc2: '',
      subsheets: [
        {
          id: 1,
          name: 'Subsheet 1',
          fields: [
            {
              id: 1,
              label: 'Length',
              infoType: 'varchar',
              uom: 'm',
              required: false,
              sortOrder: 1,
              options: [],
              value: '10',
            },
          ],
        },
      ],
    } as unknown as UnifiedSheet

    const { buffer } = await generateDatasheetExcel(sheet, 'eng', 'SI')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const auditSheet = workbook.getWorksheet('Audit Log')
    expect(auditSheet).toBeTruthy()
    // Header row + at least 1 data row
    expect((auditSheet?.rowCount ?? 0)).toBeGreaterThanOrEqual(2)
  })
})


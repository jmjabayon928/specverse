/** @jest-environment node */
import ExcelJS from 'exceljs'
import { generateDatasheetExcel } from '../../src/backend/services/_exportService'
import type { UnifiedSheet } from '../../src/domain/datasheets/sheetTypes'

const minimalSheet: UnifiedSheet = {
  sheetId: 1,
  isTemplate: false,
  status: 'Draft',
  sheetName: 'Test',
  sheetDesc: '',
  sheetDesc2: '',
  clientDocNum: 0,
  clientProjectNum: 0,
  companyDocNum: 0,
  companyProjectNum: 0,
  areaName: '',
  packageName: '',
  revisionNum: 1,
  revisionDate: '',
  preparedByName: '',
  preparedByDate: '',
  modifiedByName: undefined,
  modifiedByDate: '',
  rejectedByName: undefined,
  rejectedByDate: '',
  rejectComment: undefined,
  verifiedByName: undefined,
  verifiedDate: null,
  approvedByName: undefined,
  approvedDate: null,
  equipmentName: '',
  equipmentTagNum: '',
  serviceName: '',
  requiredQty: 0,
  itemLocation: '',
  manuName: '',
  suppName: '',
  installPackNum: undefined,
  equipSize: 0,
  modelNum: undefined,
  driver: undefined,
  pid: undefined,
  installDwg: undefined,
  codeStd: undefined,
  categoryName: '',
  clientName: '',
  projectName: '',
  areaId: 0,
  categoryId: 0,
  clientId: 0,
  manuId: 0,
  projectId: 0,
  suppId: 0,
  clientLogo: null,
  preparedById: 0,
  modifiedById: 0,
  rejectedById: 0,
  subsheets: [
    {
      id: 1,
      name: 'Sub',
      fields: [{ id: 1, label: 'F1', infoType: 'varchar', required: false, sortOrder: 1, options: [], value: 'v' }],
    },
  ],
}

jest.mock('../../src/backend/services/filledSheetService', () => ({
  getFilledSheetDetailsById: jest.fn(),
}))

const getFilledSheetDetailsById = require('../../src/backend/services/filledSheetService')
  .getFilledSheetDetailsById as jest.Mock

describe('generateDatasheetExcel header localization', () => {
  beforeEach(() => {
    getFilledSheetDetailsById.mockResolvedValue({ datasheet: minimalSheet })
  })

  it('uses localized headers for lang=fr when constants provide them', async () => {
    const buffer = await generateDatasheetExcel(1, 'SI', 'fr', 1)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.getWorksheet('Datasheet')
    expect(worksheet).toBeDefined()
    const firstRow = worksheet!.getRow(1)
    const values = [
      firstRow.getCell(1).value,
      firstRow.getCell(2).value,
      firstRow.getCell(3).value,
      firstRow.getCell(4).value,
    ]
    expect(values[0]).toBe('Étiquette')
    expect(values[1]).toBe('Unité')
    expect(values[2]).toBe('Options')
    expect(values[3]).toBe('Valeur')
  })

  it('uses English headers for lang=eng', async () => {
    const buffer = await generateDatasheetExcel(1, 'SI', 'eng', 1)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.getWorksheet('Datasheet')
    const firstRow = worksheet!.getRow(1)
    expect(firstRow.getCell(1).value).toBe('Label')
    expect(firstRow.getCell(2).value).toBe('UOM')
    expect(firstRow.getCell(3).value).toBe('Options')
    expect(firstRow.getCell(4).value).toBe('Value')
  })

  it('falls back safely for missing key (unsupported lang)', async () => {
    const buffer = await generateDatasheetExcel(1, 'SI', 'xx', 1)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.getWorksheet('Datasheet')
    const firstRow = worksheet!.getRow(1)
    expect(firstRow.getCell(1).value).toBe('InfoLabel')
    expect(firstRow.getCell(2).value).toBe('InfoUOM')
    expect(firstRow.getCell(3).value).toBe('InfoOptions')
    expect(firstRow.getCell(4).value).toBe('InfoValue')
  })
})

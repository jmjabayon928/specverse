/** @jest-environment node */
import ExcelJS from 'exceljs'
import { generateDatasheetExcel } from '../../src/utils/generateDatasheetExcel'
import type { UnifiedSheet } from '../../src/domain/datasheets/sheetTypes'

jest.mock('../../src/backend/services/sheetLogsService', () => ({
  fetchSheetLogsMerged: jest.fn().mockResolvedValue([]),
}))

/** Minimal sheet for display-revision and filename tests. */
function minimalSheet(overrides: Partial<UnifiedSheet> = {}): UnifiedSheet {
  return {
    sheetId: 1,
    isTemplate: false,
    status: 'Draft',
    sheetName: 'Test Sheet',
    sheetDesc: '',
    sheetDesc2: '',
    clientDocNum: 0,
    clientProjectNum: 0,
    companyDocNum: 0,
    companyProjectNum: 0,
    areaName: '',
    packageName: '',
    revisionNum: 2,
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
    clientName: 'Client',
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
    subsheets: [],
    ...overrides,
  }
}

describe('generateDatasheetExcel display revision (engineeringRevision)', () => {
  it('uses engineeringRevision in filename when present', async () => {
    const sheet = minimalSheet({ engineeringRevision: 'Rev-A', revisionNum: 2 })
    const { fileName } = await generateDatasheetExcel(sheet, 'eng', 'SI')
    expect(fileName).toContain('Rev-A')
    expect(fileName).not.toContain('RevNo-2-')
  })

  it('falls back to revisionNum in filename when engineeringRevision is absent', async () => {
    const sheet = minimalSheet({ revisionNum: 3 })
    const { fileName } = await generateDatasheetExcel(sheet, 'eng', 'SI')
    expect(fileName).toContain('RevNo-3-')
  })

  it('falls back to revisionNum when engineeringRevision is empty string', async () => {
    const sheet = minimalSheet({ engineeringRevision: '', revisionNum: 4 })
    const { fileName } = await generateDatasheetExcel(sheet, 'eng', 'SI')
    expect(fileName).toContain('RevNo-4-')
  })
})

describe('generateDatasheetExcel USC conversion', () => {
  it('converts SI values to USC units when uom=USC', async () => {
    const sheet: UnifiedSheet = {
      sheetId: 1,
      isTemplate: false,
      status: 'Draft',
      sheetName: 'Test Sheet',
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
      clientName: 'Client',
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
          name: 'Subsheet 1',
          fields: [
            {
              label: 'Length',
              infoType: 'decimal',
              uom: 'm',
              required: false,
              sortOrder: 1,
              options: [],
              value: 10,
            },
          ],
        },
      ],
    }

    const { buffer } = await generateDatasheetExcel(sheet, 'eng', 'USC')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const worksheet = workbook.getWorksheet('Datasheet')

    if (!worksheet) {
      throw new Error('Datasheet worksheet missing in test workbook')
    }

    let foundUSCRow = false

    worksheet.eachRow((row) => {
      const uomCell = row.getCell('G').value
      const valueCell = row.getCell('E').value

      if (uomCell === 'ft') {
        const numeric =
          typeof valueCell === 'number'
            ? valueCell
            : typeof valueCell === 'string'
              ? Number.parseFloat(valueCell)
              : NaN

        if (!Number.isNaN(numeric)) {
          // 10 m ≈ 32.81 ft; allow a small tolerance.
          expect(numeric).toBeGreaterThan(32)
          expect(numeric).toBeLessThan(33)
          foundUSCRow = true
        }
      }
    })

    expect(foundUSCRow).toBe(true)
  })
})


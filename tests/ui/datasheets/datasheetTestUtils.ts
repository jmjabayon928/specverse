// tests/ui/datasheets/datasheetTestUtils.ts
import type { UnifiedSheet } from '../../../src/domain/datasheets/sheetTypes'
import type { Option } from '../../../src/domain/shared/commonTypes'

/** Waits until reference-options fetch has applied and "Discipline 1" is visible. Call after render in tests that mock reference-options. */
export async function waitForReferenceOptionsLoaded(
  screen: { findByText: (text: string | RegExp) => Promise<HTMLElement> }
): Promise<void> {
  await screen.findByText('Discipline 1')
}

/** Returns a real Response with JSON body for fetch mocks. Requires Response polyfill (e.g. cross-fetch) in jsdom. */
export function makeJsonResponse<T>(body: T, init?: ResponseInit): Response {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export interface MockReferenceOptions {
  disciplines: Array<{ id: number; code: string; name: string }>
  subtypes: Array<{ id: number; disciplineId: number; code: string; name: string }>
  categories: Array<{ id: number; name: string }>
  users: Array<{ id: number; name: string }>
}

export function getMockReferenceOptions(): MockReferenceOptions {
  return {
    disciplines: [{ id: 1, code: 'D1', name: 'Discipline 1' }],
    subtypes: [{ id: 1, disciplineId: 1, code: 'S1', name: 'Subtype 1' }],
    categories: [],
    users: [],
  }
}

export function makeOptions(values: number[]): Option[] {
  return values.map((value) => ({
    value,
    label: `Option ${value}`,
  }))
}

export function makeBasicUnifiedSheet(): UnifiedSheet {
  const today = new Date().toISOString().slice(0, 10)

  return {
    sheetId: 1,
    sheetName: 'Test Sheet',
    sheetDesc: 'Test description',
    sheetDesc2: '',
    isLatest: true,
    isTemplate: true,
    autoCADImport: false,
    status: 'Draft',
    rejectComment: undefined,

    areaId: 1,
    areaName: 'Area 1',

    manuId: 1,
    manuName: 'Manufacturer 1',

    suppId: 1,
    suppName: 'Supplier 1',

    categoryId: 1,
    categoryName: 'Category 1',

    clientId: 1,
    clientName: 'Client 1',
    clientLogo: null,

    projectId: 1,
    projectName: 'Project 1',

    pid: 1,

    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,

    revisionNum: 1,
    revisionDate: today,

    equipmentName: 'Pump P-101',
    equipmentTagNum: 'P-101',
    serviceName: 'Service 101',
    requiredQty: 1,
    itemLocation: 'Plant',
    installPackNum: 'INST-1',
    equipSize: 100,
    modelNum: 'MODEL-1',
    driver: 'Motor',
    locationDwg: 'DWG-LOC-1',
    installDwg: 'DWG-INST-1',
    codeStd: 'ASME',

    preparedById: 1,
    preparedByName: 'Prepared User',
    preparedByDate: today,

    verifiedById: null,
    verifiedByName: undefined,
    verifiedDate: null,

    approvedById: null,
    approvedByName: undefined,
    approvedDate: null,

    modifiedById: undefined,
    modifiedByName: undefined,
    modifiedByDate: undefined,

    rejectedById: undefined,
    rejectedByName: undefined,
    rejectedByDate: undefined,

    packageName: 'PKG-1',

    templateId: undefined,
    parentSheetId: undefined,

    sourceFilePath: null,

    subsheets: [
      {
        id: 10,
        originalId: 10,
        name: 'Main',
        fields: [
          {
            id: 1001,
            originalId: 1001,
            label: 'Design Pressure',
            infoType: 'decimal',
            uom: 'kPa',
            sortOrder: 1,
            required: true,
            options: [],
            value: '10',
          },
          {
            id: 1002,
            originalId: 1002,
            label: 'Design Temperature',
            infoType: 'decimal',
            uom: '°C',
            sortOrder: 2,
            required: false,
            options: [],
            value: '100',
          },
        ],
      },
    ],

    informationValues: {},
  }
}

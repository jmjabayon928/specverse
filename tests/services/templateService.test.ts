// tests/services/templateService.test.ts
type QueryResult = { recordset: unknown[] }
type QueryFn = (sql: string) => Promise<QueryResult>
const mockQuery: jest.MockedFunction<QueryFn> = jest
  .fn<Promise<QueryResult>, [string]>()
  .mockResolvedValue({ recordset: [] })

const mockRequestChain = {
  input: jest.fn().mockReturnThis(),
  query: jest.fn().mockResolvedValue({ recordset: [] }),
}

jest.mock('../../src/backend/config/db', () => {
  const MockTransaction = class {
    begin = () => Promise.resolve()
    commit = () => Promise.resolve()
    rollback = () => Promise.resolve()
    request = () => mockRequestChain
  }
  return {
    poolPromise: Promise.resolve({
      request: () => ({
        input: jest.fn().mockReturnThis(),
        query: mockQuery,
      }),
    }),
    sql: {
      Transaction: MockTransaction,
      Int: 1,
      VarChar: () => ({}),
      Date: Date,
      Bit: 0,
      NVarChar: () => ({}),
    },
  }
})

jest.mock('../../src/backend/utils/notifyUsers', () => ({
  notifyUsers: jest.fn(),
}))

import {
  getAllNoteTypes,
  doesTemplateEquipmentTagExist,
  updateTemplate,
  verifyTemplate,
  approveTemplate,
  createTemplate,
} from '../../src/backend/services/templateService'
import { notifyUsers } from '../../src/backend/utils/notifyUsers'
import { AppError } from '../../src/backend/errors/AppError'

describe('templateService.getAllNoteTypes', () => {
  it('returns an array of note types with expected shape', async () => {
    mockQuery.mockResolvedValueOnce({
      recordset: [
        { NoteTypeID: 1, NoteType: 'General', Description: null as string | null },
      ],
    })

    const result = await getAllNoteTypes()

    expect(Array.isArray(result)).toBe(true)

    for (const noteType of result) {
      expect(typeof noteType.noteTypeId).toBe('number')
      expect(typeof noteType.noteType).toBe('string')
      if (noteType.description != null) {
        expect(typeof noteType.description).toBe('string')
      }
    }
  })
})

describe('templateService.doesTemplateEquipmentTagExist', () => {
  it('returns false for a clearly non-existent tag / project combination', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [] })

    const fakeTag = '@@@__nonexistent_tag__@@@'
    const fakeProjectId = 999_999

    const exists = await doesTemplateEquipmentTagExist(fakeTag, fakeProjectId)

    expect(exists).toBe(false)
  })
})

describe('templateService.doesTemplateEquipmentTagExist – true case', () => {
  it('returns true when a matching (EquipmentTagNum, ProjectID) exists', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ Exists: 1 }] })

    const projectId = 98765
    const testTag = 'TEST-TAG-XYZ'

    const exists = await doesTemplateEquipmentTagExist(testTag, projectId)

    expect(exists).toBe(true)
  })
})

describe('templateService.updateTemplate', () => {
  const minimalUnifiedSheet = {
    sheetName: 'Test',
    sheetDesc: 'Desc',
    sheetDesc2: '',
    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,
    areaId: 1,
    packageName: 'Pkg',
    revisionNum: 1,
    revisionDate: '2025-01-01',
    equipmentName: 'Eq',
    equipmentTagNum: 'TAG',
    serviceName: 'Svc',
    requiredQty: 1,
    itemLocation: 'Loc',
    manuId: 1,
    suppId: 1,
    installPackNum: '',
    equipSize: 1,
    modelNum: '',
    driver: '',
    locationDwg: '',
    pid: 1,
    installDwg: '',
    codeStd: '',
    categoryId: 1,
    clientId: 1,
    projectId: 1,
    disciplineId: 1,
    subtypeId: null,
    subsheets: [],
  }

  it('resolves with sheetId even when notifyUsers rejects', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ Status: 'Draft' }] })
    ;(notifyUsers as jest.Mock).mockRejectedValueOnce(new Error('notify failed'))

    const sheetId = 1045
    const userId = 1
    const result = await updateTemplate(sheetId, minimalUnifiedSheet as never, userId)

    expect(result).toBe(sheetId)
    expect(notifyUsers).toHaveBeenCalled()
  })

  it('rejects with 409 when template status is Approved', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ Status: 'Approved' }] })

    const sheetId = 1045
    const userId = 1
    const p = updateTemplate(sheetId, minimalUnifiedSheet as never, userId)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('only be edited when status'),
    })
  })
})

describe('templateService.verifyTemplate', () => {
  it('rejects with 409 when template status is Verified', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ Status: 'Verified' }] })

    const sheetId = 10
    const userId = 1
    const p = verifyTemplate(sheetId, 'verify', undefined, userId)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('only be verified or rejected when status'),
    })
  })

  it('rejects with 409 when template status is Approved', async () => {
    mockQuery.mockResolvedValueOnce({ recordset: [{ Status: 'Approved' }] })

    const sheetId = 10
    const userId = 1
    const p = verifyTemplate(sheetId, 'reject', 'comment', userId)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({ statusCode: 409 })
  })
})

describe('templateService.approveTemplate', () => {
  it('rejects with 409 when template status is Draft', async () => {
    mockQuery
      .mockResolvedValueOnce({ recordset: [] as unknown[], rowsAffected: [0] } as QueryResult & { rowsAffected: number[] })
      .mockResolvedValueOnce({ recordset: [{ Status: 'Draft' }] })

    const sheetId = 10
    const userId = 1
    const p = approveTemplate(sheetId, userId)
    await expect(p).rejects.toThrow(AppError)
    await expect(p).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining('only be approved when status is Verified'),
    })
  })
})

describe('templateService.createTemplate', () => {
  const minimalCreatePayload = {
    sheetName: 'Test Template',
    sheetDesc: 'Description',
    sheetDesc2: '',
    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,
    areaId: 1,
    packageName: 'Pkg',
    revisionNum: 1,
    revisionDate: '2025-01-01',
    preparedById: 1,
    preparedByDate: '2025-01-01T00:00:00.000Z',
    equipmentName: 'Eq',
    equipmentTagNum: 'TAG',
    serviceName: 'Svc',
    requiredQty: 1,
    itemLocation: 'Loc',
    manuId: 1,
    suppId: 1,
    installPackNum: '',
    equipSize: 1,
    modelNum: '',
    driver: '',
    locationDwg: '',
    pid: 1,
    installDwg: '',
    codeStd: '',
    categoryId: 1,
    clientId: 1,
    projectId: 1,
    disciplineId: 1,
    subtypeId: null,
    subsheets: [
      {
        id: 20000000000,
        name: 'Subsheet One',
        fields: [
          {
            label: 'Field 1',
            infoType: 'varchar' as const,
            uom: '',
            required: false,
            sortOrder: 0,
            options: [],
          },
        ],
      },
    ],
  }

  it('does not pass client subsheet id as TemplateSubID (avoids INT overflow)', async () => {
    (notifyUsers as jest.Mock).mockResolvedValueOnce(undefined)
    mockRequestChain.query
      .mockResolvedValueOnce({ recordset: [{ SheetID: 1 }] })
      .mockResolvedValueOnce({ recordset: [{ SubID: 10 }] })
      .mockResolvedValueOnce({ recordset: [{ InfoTemplateID: 100 }] })

    const userId = 1
    const sheetId = await createTemplate(minimalCreatePayload as never, userId)

    expect(sheetId).toBe(1)
    expect(mockRequestChain.input).toHaveBeenCalledWith('TemplateSubID', 1, null)
  })
})
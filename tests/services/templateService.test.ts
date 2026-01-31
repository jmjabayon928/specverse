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
} from '../../src/backend/services/templateService'
import { notifyUsers } from '../../src/backend/utils/notifyUsers'

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
    ;(notifyUsers as jest.Mock).mockRejectedValueOnce(new Error('notify failed'))

    const sheetId = 1045
    const userId = 1
    const result = await updateTemplate(sheetId, minimalUnifiedSheet as never, userId)

    expect(result).toBe(sheetId)
    expect(notifyUsers).toHaveBeenCalled()
  })
})
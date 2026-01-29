// tests/services/templateService.test.ts
type QueryResult = { recordset: unknown[] }
type QueryFn = (sql: string) => Promise<QueryResult>
const mockQuery: jest.MockedFunction<QueryFn> = jest
  .fn<Promise<QueryResult>, [string]>()
  .mockResolvedValue({ recordset: [] })

jest.mock('../../src/backend/config/db', () => {
  const MockTransaction = class {
    begin = () => Promise.resolve()
    commit = () => Promise.resolve()
    rollback = () => Promise.resolve()
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
      NVarChar: () => ({}),
    },
  }
})

import {
  getAllNoteTypes,
  doesTemplateEquipmentTagExist,
} from '../../src/backend/services/templateService'

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
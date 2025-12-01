// tests/services/templateService.test.ts
import { poolPromise, sql } from '../../src/backend/config/db'
import {
  getAllNoteTypes,
  doesTemplateEquipmentTagExist,
} from '../../src/backend/services/templateService'

describe('templateService.getAllNoteTypes', () => {
  it('returns an array of note types with expected shape', async () => {
    const result = await getAllNoteTypes()

    expect(Array.isArray(result)).toBe(true)

    for (const noteType of result) {
      expect(typeof noteType.noteTypeId).toBe('number')
      expect(typeof noteType.noteType).toBe('string')
      // description may be null, so only check type if not null
      if (noteType.description != null) {
        expect(typeof noteType.description).toBe('string')
      }
    }
  })
})

describe('templateService.doesTemplateEquipmentTagExist', () => {
  it('returns false for a clearly non-existent tag / project combination', async () => {
    const fakeTag = '@@@__nonexistent_tag__@@@'
    const fakeProjectId = 999_999

    const exists = await doesTemplateEquipmentTagExist(fakeTag, fakeProjectId)

    expect(exists).toBe(false)
  })
})

describe('templateService.doesTemplateEquipmentTagExist – true case', () => {
  it('returns true when a matching (EquipmentTagNum, ProjectID) exists', async () => {
    const pool = await poolPromise

    // --- Begin a controlled transaction (MSSQL style) ---
    const transaction = new sql.Transaction(pool)
    await transaction.begin()

    try {
      const request = new sql.Request(transaction)

      // --- Arrange -------------------------------------------------------
      const projectId = 98765
      const testTag = 'TEST-TAG-XYZ'

      // Insert a fake project
      await request.query(`
        INSERT INTO Projects (ProjectID, ProjectName)
        VALUES (${projectId}, 'Unit Test Project')
      `)

      // Insert a fake template
      const insertResult = await request.query(`
        INSERT INTO Sheets
          (SheetName, IsTemplate, ProjectID, EquipmentTagNum, AreaID, CategoryID)
        OUTPUT INSERTED.SheetID
        VALUES
          ('Unit Test Template', 1, ${projectId}, '${testTag}', 1, 1)
      `)

      const newTemplateId = insertResult.recordset[0].SheetID
      expect(typeof newTemplateId).toBe('number')

      // --- Act ----------------------------------------------------------
      const exists = await doesTemplateEquipmentTagExist(testTag, projectId)

      // --- Assert --------------------------------------------------------
      expect(exists).toBe(true)

      // Even if successful → rollback to avoid DB pollution
      await transaction.rollback()
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  })
})
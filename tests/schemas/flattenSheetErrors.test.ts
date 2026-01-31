// tests/schemas/flattenSheetErrors.test.ts
import { unifiedSheetSchema } from '../../src/validation/sheetSchema'
import { flattenSheetZodErrors } from '../../src/validation/flattenSheetErrors'

/** Minimal valid top-level for a sheet (enough to get nested path errors). */
function minimalTopLevel() {
  return {
    sheetName: 'Test',
    sheetDesc: 'Desc',
    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,
    areaId: 1,
    packageName: 'P',
    revisionNum: 1,
    revisionDate: '2025-01-01',
    preparedById: 1,
    preparedByDate: '2025-01-01',
    itemLocation: 'L',
    requiredQty: 1,
    equipmentName: 'E',
    equipmentTagNum: 'T',
    serviceName: 'S',
    manuId: 1,
    suppId: 1,
    equipSize: 1,
    categoryId: 1,
    clientId: 1,
    projectId: 1,
  }
}

describe('flattenSheetZodErrors', () => {
  it('emits dot-path keys for nested subsheet field errors', () => {
    const candidate = {
      ...minimalTopLevel(),
      subsheets: [
        {
          name: 'Main',
          fields: [
            {
              label: '',
              infoType: 'varchar' as const,
              sortOrder: 1,
              required: false,
              options: [],
            },
          ],
        },
      ],
    }

    const result = unifiedSheetSchema.safeParse(candidate)
    expect(result.success).toBe(false)

    if (result.success) return
    const flattened = flattenSheetZodErrors(result.error)

    expect(flattened['subsheets.0.fields.0.label']).toEqual(['Field label is required'])
  })

  it('emits dot-path keys for subsheet name errors', () => {
    const candidate = {
      ...minimalTopLevel(),
      subsheets: [
        {
          name: '',
          fields: [
            {
              label: 'A',
              infoType: 'varchar' as const,
              sortOrder: 1,
              required: false,
              options: [],
            },
          ],
        },
      ],
    }

    const result = unifiedSheetSchema.safeParse(candidate)
    expect(result.success).toBe(false)

    if (result.success) return
    const flattened = flattenSheetZodErrors(result.error)

    expect(flattened['subsheets.0.name']).toEqual(['Subsheet name is required'])
  })

  it('emits dot-path for top-level fields', () => {
    const candidate = {
      ...minimalTopLevel(),
      sheetName: '',
      subsheets: [
        {
          name: 'Main',
          fields: [
            {
              label: 'A',
              infoType: 'varchar' as const,
              sortOrder: 1,
              required: false,
              options: [],
            },
          ],
        },
      ],
    }

    const result = unifiedSheetSchema.safeParse(candidate)
    expect(result.success).toBe(false)

    if (result.success) return
    const flattened = flattenSheetZodErrors(result.error)

    expect(flattened['sheetName']).toEqual(['Sheet Name is required'])
  })
})

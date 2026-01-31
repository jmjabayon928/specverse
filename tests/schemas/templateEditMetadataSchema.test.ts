// tests/schemas/templateEditMetadataSchema.test.ts
import { templateEditMetadataSchema, unifiedSheetSchema } from '../../src/validation/sheetSchema'

/** Minimal valid metadata for template edit (all required top-level fields). */
function minimalValidMetadata() {
  return {
    sheetId: 1,
    sheetName: 'Test Sheet',
    sheetDesc: 'Test description',
    sheetDesc2: '',
    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,
    areaId: 1,
    packageName: 'PKG-1',
    revisionNum: 1,
    revisionDate: '2025-01-01',
    preparedById: 1,
    preparedByDate: '2025-01-01',
    itemLocation: 'Plant',
    requiredQty: 1,
    equipmentName: 'Pump',
    equipmentTagNum: 'P-101',
    serviceName: 'Service',
    manuId: 1,
    suppId: 1,
    equipSize: 100,
    categoryId: 1,
    clientId: 1,
    projectId: 1,
  }
}

describe('templateEditMetadataSchema', () => {
  it('passes when metadata is valid and subsheets have required fields with no value', () => {
    const candidate = {
      ...minimalValidMetadata(),
      subsheets: [
        {
          id: 10,
          name: 'Main',
          fields: [
            {
              id: 1001,
              label: 'Design Pressure',
              infoType: 'decimal' as const,
              uom: 'kPa',
              sortOrder: 1,
              required: true,
              options: [],
              // value intentionally omitted - would fail unifiedSheetSchema
            },
          ],
        },
      ],
    }

    const result = templateEditMetadataSchema.safeParse(candidate)

    expect(result.success).toBe(true)
  })

  it('would fail unifiedSheetSchema for same payload (value required)', () => {
    const candidate = {
      ...minimalValidMetadata(),
      subsheets: [
        {
          id: 10,
          name: 'Main',
          fields: [
            {
              id: 1001,
              label: 'Design Pressure',
              infoType: 'decimal' as const,
              uom: 'kPa',
              sortOrder: 1,
              required: true,
              options: [],
              // no value
            },
          ],
        },
      ],
    }

    const fullResult = unifiedSheetSchema.safeParse(candidate)
    expect(fullResult.success).toBe(false)
  })

  it('fails when required metadata is missing', () => {
    const candidate = {
      ...minimalValidMetadata(),
      sheetName: '',
    }

    const result = templateEditMetadataSchema.safeParse(candidate)

    expect(result.success).toBe(false)
  })
})

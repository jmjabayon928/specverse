// tests/schemas/unifiedTemplateSchema.test.ts
import { unifiedTemplateSchema, unifiedSheetSchema } from '../../src/validation/sheetSchema'

/** Minimal valid top-level fields for a sheet (template create/clone). */
function minimalValidTopLevel() {
  return {
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
    disciplineId: 1,
    subtypeId: null as number | null | undefined,
  }
}

describe('unifiedTemplateSchema', () => {
  it('passes when required field has no value (template builder defines the field)', () => {
    const candidate = {
      ...minimalValidTopLevel(),
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
              // value intentionally omitted - template builder does not require value
            },
          ],
        },
      ],
    }

    const result = unifiedTemplateSchema.safeParse(candidate)

    expect(result.success).toBe(true)
  })

  it('passes for int field with required=true and empty value', () => {
    const candidate = {
      ...minimalValidTopLevel(),
      subsheets: [
        {
          id: 10,
          name: 'Count',
          fields: [
            {
              label: 'Quantity',
              infoType: 'int' as const,
              sortOrder: 1,
              required: true,
              options: [],
              value: '',
            },
          ],
        },
      ],
    }

    const result = unifiedTemplateSchema.safeParse(candidate)

    expect(result.success).toBe(true)
  })

  it('would fail unifiedSheetSchema for same payload (value required when required=true)', () => {
    const candidate = {
      ...minimalValidTopLevel(),
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
})

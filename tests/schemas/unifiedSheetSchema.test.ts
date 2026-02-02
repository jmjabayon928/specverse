// tests/schemas/unifiedSheetSchema.test.ts
import { unifiedSheetSchema } from '../../src/validation/sheetSchema'
import { makeBasicUnifiedSheet } from '../ui/datasheets/datasheetTestUtils'

describe('unifiedSheetSchema', () => {
  it('accepts field.uom as array and transforms to string', () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.isTemplate = false
    const firstField = sheet.subsheets[0].fields[0]
    firstField.uom = ['kW', 'kW'] as unknown as string

    const result = unifiedSheetSchema.safeParse(sheet)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subsheets[0].fields[0].uom).toBe('kW')
    }
  })

  it('rejects payload with no subsheets array', () => {
    const candidate = {
      sheetName: 'Test Sheet',
      // subsheets is intentionally missing
    }

    const result = unifiedSheetSchema.safeParse(candidate)

    expect(result.success).toBe(false)
  })

  it('rejects payload with an empty subsheets array', () => {
    const candidate = {
      sheetName: 'Test Sheet',
      subsheets: [],
    }

    const result = unifiedSheetSchema.safeParse(candidate)

    expect(result.success).toBe(false)
  })

  it('rejects payload when subsheets is not an array', () => {
    const candidate = {
      sheetName: 'Test Sheet',
      subsheets: {},
    }

    const result = unifiedSheetSchema.safeParse(candidate)

    expect(result.success).toBe(false)
  })
})

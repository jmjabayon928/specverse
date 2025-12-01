// tests/schemas/unifiedSheetSchema.test.ts
import { unifiedSheetSchema } from '../../src/validation/sheetSchema'

describe('unifiedSheetSchema', () => {
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

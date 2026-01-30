// tests/utils/datasheetCompleteness.test.ts
import { computeCompleteness, getSubsheetKey } from '../../src/utils/datasheetCompleteness'
import type { UnifiedSubsheet } from '../../src/domain/datasheets/sheetTypes'

function makeSubsheet(
  name: string,
  fields: Array<{ id?: number; required: boolean; value?: string | number | null }>
): UnifiedSubsheet {
  return {
    name,
    fields: fields.map((f, i) => ({
      id: f.id ?? 1000 + i,
      label: `Field ${i}`,
      infoType: 'varchar' as const,
      sortOrder: i,
      required: f.required,
      value: f.value,
    })),
  }
}

describe('computeCompleteness', () => {
  it('returns 0/0 when no subsheets', () => {
    const result = computeCompleteness([])
    expect(result.totalRequired).toBe(0)
    expect(result.filledRequired).toBe(0)
    expect(result.bySubsheet).toEqual({})
  })

  it('counts one required empty as incomplete', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('Main', [{ required: true, value: '' }]),
    ]
    const result = computeCompleteness(subsheets)
    expect(result.totalRequired).toBe(1)
    expect(result.filledRequired).toBe(0)
    const key = getSubsheetKey(subsheets[0], 0)
    expect(result.bySubsheet[key].totalRequired).toBe(1)
    expect(result.bySubsheet[key].filledRequired).toBe(0)
  })

  it('counts one required filled as complete', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('Main', [{ required: true, value: 'x' }]),
    ]
    const result = computeCompleteness(subsheets)
    expect(result.totalRequired).toBe(1)
    expect(result.filledRequired).toBe(1)
    const key = getSubsheetKey(subsheets[0], 0)
    expect(result.bySubsheet[key].filledRequired).toBe(1)
  })

  it('ignores optional fields for counts', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('Main', [
        { required: false, value: '' },
        { required: true, value: 'a' },
      ]),
    ]
    const result = computeCompleteness(subsheets)
    expect(result.totalRequired).toBe(1)
    expect(result.filledRequired).toBe(1)
  })

  it('treats numeric 0 as complete', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('Main', [{ required: true, value: 0 }]),
    ]
    const result = computeCompleteness(subsheets)
    expect(result.totalRequired).toBe(1)
    expect(result.filledRequired).toBe(1)
  })

  it('treats required select with empty string as incomplete', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('Main', [{ required: true, value: '' }]),
    ]
    const result = computeCompleteness(subsheets)
    expect(result.filledRequired).toBe(0)
  })

  it('mixed required/optional and empty/non-empty', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('A', [
        { required: true, value: 'x' },
        { required: true, value: '' },
        { required: false, value: '' },
      ]),
      makeSubsheet('B', [
        { required: true, value: 0 },
        { required: true, value: null },
      ]),
    ]
    const result = computeCompleteness(subsheets)
    expect(result.totalRequired).toBe(4)
    expect(result.filledRequired).toBe(2)
    const keyA = getSubsheetKey(subsheets[0], 0)
    const keyB = getSubsheetKey(subsheets[1], 1)
    expect(result.bySubsheet[keyA].totalRequired).toBe(2)
    expect(result.bySubsheet[keyA].filledRequired).toBe(1)
    expect(result.bySubsheet[keyB].totalRequired).toBe(2)
    expect(result.bySubsheet[keyB].filledRequired).toBe(1)
  })

  it('uses fieldValues override when provided (edit mode)', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('Main', [
        { id: 1001, required: true, value: '' },
        { id: 1002, required: true, value: '' },
      ]),
    ]
    const fieldValues: Record<string, string> = {
      '1001': 'filled',
      '1002': '',
    }
    const result = computeCompleteness(subsheets, fieldValues)
    expect(result.totalRequired).toBe(2)
    expect(result.filledRequired).toBe(1)
  })

  it('falls back to field.value when fieldValues has no key for field.id', () => {
    const subsheets: UnifiedSubsheet[] = [
      makeSubsheet('Main', [{ id: 1001, required: true, value: 'from-field' }]),
    ]
    const result = computeCompleteness(subsheets, {})
    expect(result.filledRequired).toBe(1)
  })

  it('keys bySubsheet by subsheet id (or originalId, or index)', () => {
    const subsheets: UnifiedSubsheet[] = [
      { name: 'A', id: 10, fields: [] },
      { name: 'B', originalId: 20, fields: [] },
      { name: 'C', fields: [] },
    ]
    const result = computeCompleteness(subsheets)
    expect(result.bySubsheet['10']?.subName).toBe('A')
    expect(result.bySubsheet['20']?.subName).toBe('B')
    expect(result.bySubsheet['2']?.subName).toBe('C')
  })
})

describe('getSubsheetKey', () => {
  it('uses id when present', () => {
    expect(getSubsheetKey({ name: 'X', id: 5, fields: [] }, 0)).toBe('5')
  })
  it('uses originalId when id missing', () => {
    expect(getSubsheetKey({ name: 'X', originalId: 7, fields: [] }, 0)).toBe('7')
  })
  it('falls back to index when neither id nor originalId', () => {
    expect(getSubsheetKey({ name: 'X', fields: [] }, 2)).toBe('2')
  })
})

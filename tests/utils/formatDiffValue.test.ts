import { formatDiffValue } from '@/app/(admin)/datasheets/filled/[id]/revisions/formatDiffValue'

describe('formatDiffValue', () => {
  it('returns em dash for null and undefined', () => {
    expect(formatDiffValue(null)).toBe('—')
    expect(formatDiffValue(undefined)).toBe('—')
  })

  it('returns em dash for empty string', () => {
    expect(formatDiffValue('')).toBe('—')
  })

  it('returns Yes/No for booleans', () => {
    expect(formatDiffValue(true)).toBe('Yes')
    expect(formatDiffValue(false)).toBe('No')
  })

  it('returns comma-separated list for arrays', () => {
    expect(formatDiffValue(['a', 'b'])).toBe('a, b')
    expect(formatDiffValue([1, 2])).toBe('1, 2')
  })

  it('returns single-line JSON for plain objects', () => {
    expect(formatDiffValue({ x: 1 })).toBe('{"x":1}')
  })

  it('returns string and number as-is (stringified)', () => {
    expect(formatDiffValue('hello')).toBe('hello')
    expect(formatDiffValue(42)).toBe('42')
  })
})

// tests/utils/normalizeUom.test.ts
import { normalizeUom } from '../../src/utils/normalizeUom'

describe('normalizeUom', () => {
  it('returns trimmed string when given string', () => {
    expect(normalizeUom('kW')).toBe('kW')
    expect(normalizeUom('  kPa  ')).toBe('kPa')
  })

  it('returns first non-empty string when given array', () => {
    expect(normalizeUom(['kW', 'kW'])).toBe('kW')
    expect(normalizeUom(['', 'cm'])).toBe('cm')
    expect(normalizeUom(['  ', 'MPa'])).toBe('MPa')
  })

  it('returns empty string when given empty array', () => {
    expect(normalizeUom([])).toBe('')
  })

  it('returns empty string when given null or undefined', () => {
    expect(normalizeUom(null)).toBe('')
    expect(normalizeUom(undefined)).toBe('')
  })

  it('coerces other types to string and trims', () => {
    expect(normalizeUom(123)).toBe('123')
  })
})

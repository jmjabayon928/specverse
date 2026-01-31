// tests/utils/unitConversionTable.test.ts
// Regression: expanded UOM (kN, ppm, N/mm², mA, mg/L, W) must be passed through when not in conversion table.
import { convertToUSC } from '../../src/utils/unitConversionTable'

describe('convertToUSC', () => {
  it('returns original value and unit when unit is not in conversion table (expanded UOM pass-through)', () => {
    // Expanded v0.5 units with no SI↔USC conversion: must display as-is on template/filled viewer and export.
    const unknownUnits = ['kN', 'ppm', 'N/mm²', 'mA', 'mg/L', 'W']
    for (const unit of unknownUnits) {
      const result = convertToUSC('42.5', unit)
      expect(result).toEqual({ value: '42.5', unit })
    }
  })

  it('converts known SI unit to USC (sanity check)', () => {
    const result = convertToUSC('1', 'm')
    expect(result.unit).toBe('ft')
    expect(Number.parseFloat(result.value)).toBeCloseTo(3.28084, 2)
  })
})

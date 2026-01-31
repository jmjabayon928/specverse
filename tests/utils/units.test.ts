// tests/utils/units.test.ts
import { groupedSIUnits } from '../../src/utils/units'

describe('groupedSIUnits', () => {
  it('includes Electrical group with A, V, Hz, and mA', () => {
    expect(groupedSIUnits).toHaveProperty('Electrical')
    const electrical = groupedSIUnits.Electrical
    expect(Array.isArray(electrical)).toBe(true)
    expect(electrical).toContain('A')
    expect(electrical).toContain('V')
    expect(electrical).toContain('Hz')
    expect(electrical).toContain('mA')
  })

  it('includes v0.5 expansion groups and units for general engineering', () => {
    expect(groupedSIUnits).toHaveProperty('Concentration')
    expect(groupedSIUnits.Concentration).toContain('ppm')
    expect(groupedSIUnits.Concentration).toContain('mg/L')

    expect(groupedSIUnits.Force).toContain('kN')
    expect(groupedSIUnits.Pressure).toContain('N/mm²')
    expect(groupedSIUnits.Power).toContain('W')
  })
})

// tests/utils/unitConversionTable.test.ts
// Regression: expanded UOM (ppm, mA, mg/L) must be passed through when not in conversion table.
// N/mm² normalizes to MPa; kN, W have conversions. Round-trip and edge-case tests.
import { normalizeUnit } from '../../src/utils/unitKinds'
import {
  convertToUSC,
  convertToSI,
  convertValue,
} from '../../src/utils/unitConversionTable'

describe('normalizeUnit', () => {
  it('normalizes N/mm² to mpa (1 N/mm² = 1 MPa)', () => {
    expect(normalizeUnit('N/mm²')).toBe('mpa')
    expect(normalizeUnit('n/mm2')).toBe('mpa')
    expect(normalizeUnit('N/mm^2')).toBe('mpa')
  })

  it('accepts unknown and does not throw (no .trim() on non-string)', () => {
    expect(normalizeUnit(null)).toBe('')
    expect(normalizeUnit(undefined)).toBe('')
    expect(normalizeUnit(123)).toBe('123')
    expect(normalizeUnit(['kW', 'kW'])).toBe('kw,kw')
    expect(normalizeUnit('  kPa  ')).toBe('kpa')
  })
})

describe('convertToUSC', () => {
  it('returns original value and unit when unit is not in conversion table (pass-through)', () => {
    const unknownUnits = ['ppm', 'mg/L', 'mA']
    for (const unit of unknownUnits) {
      const result = convertToUSC('42.5', unit)
      expect(result).toEqual({ value: '42.5', unit })
    }
  })

  it('N/mm² converts like MPa (normalizes to mpa → ksi)', () => {
    const result = convertToUSC('1', 'N/mm²')
    expect(result.unit).toBe('ksi')
    expect(Number.parseFloat(result.value)).toBeCloseTo(0.1450377377, 2)
  })

  it('converts known SI unit to USC (sanity check)', () => {
    const result = convertToUSC('1', 'm')
    expect(result.unit).toBe('ft')
    expect(Number.parseFloat(result.value)).toBeCloseTo(3.28084, 2)
  })

  it('converts kg/m.s2 to psi (regression: was incorrectly N/m²)', () => {
    const result = convertToUSC('1', 'kg/m.s2')
    expect(result.unit).toBe('psi')
    expect(result.value).toBe('0.00')
    const resultLarge = convertToUSC('10000', 'kg/m.s2')
    expect(resultLarge.unit).toBe('psi')
    expect(Number.parseFloat(resultLarge.value)).toBeCloseTo(1.450377377, 2)
  })

  it('convertToUSC(valueStr, 123 as unknown) does not throw', () => {
    const result = convertToUSC('1', 123 as unknown)
    expect(result).toEqual({ value: '1', unit: '123' })
  })

  it('convertToUSC(valueStr, null) does not throw', () => {
    const result = convertToUSC('1', null)
    expect(result).toEqual({ value: '1', unit: '' })
  })

  it('convertToUSC(valueStr, undefined) does not throw', () => {
    const result = convertToUSC('1', undefined)
    expect(result).toEqual({ value: '1', unit: '' })
  })
})

describe('convertToSI', () => {
  it('converts psi back to SI (target SI unit is returned)', () => {
    const result = convertToSI('1', 'psi')
    expect(result.unit).toBeDefined()
    expect(Number.parseFloat(result.value)).toBeGreaterThan(0)
  })
})

// SI units that have matching quantity kind for both SI and USC in unitKinds, so convertValue works.
const SI_UNITS_WITH_CONVERT_VALUE: string[] = [
  'm',
  'cm',
  'mm',
  'kg',
  'g',
  'L',
  'm3',
  'Pa',
  'bar',
  '°C',
  'm/s',
  'kW',
  'W',
  'kg/m³',
  'kPa(a)',
  'Pa·s',
  'm³/h',
  'm³/min',
  'L/min',
  'kPa',
  'kPa(g)',
  'MPa',
  'kN',
  'm²',
  'cm²',
  'mm²',
  'm2.K/W',
  'kJ/kg.K',
  'kJ/kg @ °C',
  'kg/m3',
  'km/h',
  'Nm³/h',
  'bar(g)',
]

const ROUND_TRIP_ABS_TOL = 0.05
const ROUND_TRIP_REL_TOL = 0.002

function roundTripClose(back: number, original: number): boolean {
  if (original === 0) return back === 0
  const absDiff = Math.abs(back - original)
  if (absDiff <= ROUND_TRIP_ABS_TOL) return true
  return absDiff / Math.abs(original) <= ROUND_TRIP_REL_TOL
}

describe('round-trip SI → USC → SI (via convertValue)', () => {
  for (const siUnit of SI_UNITS_WITH_CONVERT_VALUE) {
    const uscResult = convertToUSC('1', siUnit)
    const uscUnit = uscResult.unit
    if (uscUnit === siUnit) continue

    describe(`pair ${siUnit} ↔ ${uscUnit}`, () => {
      let firstValue: number
      let secondValue: number

      if (siUnit === '°C') {
        firstValue = 0
        secondValue = 100
      } else if (siUnit === 'Pa' || siUnit === 'MPa') {
        firstValue = siUnit === 'Pa' ? 10000 : 1
        secondValue = 123.45
      } else {
        firstValue = 1
        secondValue = 123.45
      }

      it(`round-trip with value ${firstValue}`, () => {
        const toUSC = convertValue(firstValue, siUnit, uscUnit)
        expect(toUSC).not.toBeNull()
        const back = convertValue(toUSC as number, uscUnit, siUnit)
        expect(back).not.toBeNull()
        expect(roundTripClose(back as number, firstValue)).toBe(true)
      })

      it(`round-trip with value ${secondValue}`, () => {
        const toUSC = convertValue(secondValue, siUnit, uscUnit)
        expect(toUSC).not.toBeNull()
        const back = convertValue(toUSC as number, uscUnit, siUnit)
        expect(back).not.toBeNull()
        expect(roundTripClose(back as number, secondValue)).toBe(true)
      })
    })
  }
})

describe('temperature edge case', () => {
  it('0 °C → °F → °C returns ≈ 0', () => {
    const toF = convertToUSC('0', '°C')
    expect(toF.unit).toBe('°F')
    expect(Number.parseFloat(toF.value)).toBeCloseTo(32, 2)
    const back = convertToSI(toF.value, toF.unit)
    expect(back.unit).toBe('°C')
    const backVal = Number.parseFloat(back.value)
    expect(backVal).toBeCloseTo(0, 2)
  })
})

describe('unknown unit pass-through', () => {
  const unknownUnits = ['ppm', 'mg/L', 'mA']

  for (const unit of unknownUnits) {
    it(`${unit}: value and unit unchanged`, () => {
      const resultUSC = convertToUSC('42.5', unit)
      expect(resultUSC).toEqual({ value: '42.5', unit })

      const resultSI = convertToSI('42.5', unit)
      expect(resultSI).toEqual({ value: '42.5', unit })
    })
  }
})

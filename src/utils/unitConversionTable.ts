// src/utils/unitConversionTable.ts
import { getQuantityKind, normalizeUnit } from './unitKinds'

type ConversionEntry = {
  siUnit: string
  uscUnit: string
  convertToUSC: (siValue: number) => number
  convertToSI: (uscValue: number) => number
}

// Table of SI↔USC conversions.
// Display strings are kept as-is; lookups use normalizeUnit for consistency.
const conversionTable: ConversionEntry[] = [
  { siUnit: 'm', uscUnit: 'ft', convertToUSC: v => v * 3.28084, convertToSI: v => v / 3.28084 },
  { siUnit: 'cm', uscUnit: 'in', convertToUSC: v => v * 0.393701, convertToSI: v => v / 0.393701 },
  { siUnit: 'mm', uscUnit: 'in', convertToUSC: v => v * 0.0393701, convertToSI: v => v / 0.0393701 },
  { siUnit: 'kg', uscUnit: 'lb', convertToUSC: v => v * 2.20462, convertToSI: v => v / 2.20462 },
  { siUnit: 'g', uscUnit: 'oz', convertToUSC: v => v * 0.035274, convertToSI: v => v / 0.035274 },
  { siUnit: 'L', uscUnit: 'gal', convertToUSC: v => v * 0.264172, convertToSI: v => v / 0.264172 },
  { siUnit: 'm3', uscUnit: 'ft3', convertToUSC: v => v * 35.3147, convertToSI: v => v / 35.3147 },
  { siUnit: 'Pa', uscUnit: 'psi', convertToUSC: v => v * 0.000145038, convertToSI: v => v / 0.000145038 },
  { siUnit: 'bar', uscUnit: 'psi', convertToUSC: v => v * 14.5038, convertToSI: v => v / 14.5038 },
  { siUnit: '°C', uscUnit: '°F', convertToUSC: v => (v * 9) / 5 + 32, convertToSI: v => ((v - 32) * 5) / 9 },
  { siUnit: 'm/s', uscUnit: 'ft/s', convertToUSC: v => v * 3.28084, convertToSI: v => v / 3.28084 },
  { siUnit: 'm/s²', uscUnit: 'ft/s²', convertToUSC: v => v * 3.28084, convertToSI: v => v / 3.28084 },
  { siUnit: 'kW', uscUnit: 'hp', convertToUSC: v => v * 1.34102, convertToSI: v => v / 1.34102 },
  { siUnit: 'kg/m³', uscUnit: 'lb/ft³', convertToUSC: v => v * 0.06243, convertToSI: v => v / 0.06243 },
  { siUnit: 'kPa(a)', uscUnit: 'psi', convertToUSC: v => v * 0.145038, convertToSI: v => v / 0.145038 },
  { siUnit: 'Pa·s', uscUnit: 'cP', convertToUSC: v => v * 1000, convertToSI: v => v / 1000 },
  { siUnit: 'm³/h', uscUnit: 'gpm', convertToUSC: v => v * 4.40287, convertToSI: v => v / 4.40287 },
  { siUnit: 'm³/min', uscUnit: 'cfm', convertToUSC: v => v * 35.3147, convertToSI: v => v / 35.3147 },
  { siUnit: 'L/min', uscUnit: 'gpm', convertToUSC: v => v * 0.264172, convertToSI: v => v / 0.264172 },
  { siUnit: 'kg/h', uscUnit: 'lb/h', convertToUSC: v => v * 2.20462, convertToSI: v => v / 2.20462 },
  { siUnit: 'kPa', uscUnit: 'psi', convertToUSC: v => v * 0.145038, convertToSI: v => v / 0.145038 },
  { siUnit: 'kPa(g)', uscUnit: 'psi(g)', convertToUSC: v => v * 0.145038, convertToSI: v => v / 0.145038 },
  { siUnit: 'MPa', uscUnit: 'ksi', convertToUSC: v => v * 145.038, convertToSI: v => v / 145.038 },
  { siUnit: 'mPa.s', uscUnit: 'cP', convertToUSC: v => v * 1, convertToSI: v => v / 1 },
  { siUnit: 'W/m.K', uscUnit: 'BTU/(hr·ft·°F)', convertToUSC: v => v * 0.5778, convertToSI: v => v / 0.5778 },
  { siUnit: 'W/m2.K', uscUnit: 'BTU/(hr·ft²·°F)', convertToUSC: v => v * 0.1761, convertToSI: v => v / 0.1761 },
  { siUnit: 'm2.K/W', uscUnit: 'ft²·°F·hr/BTU', convertToUSC: v => v * 5.6783, convertToSI: v => v / 5.6783 },
  { siUnit: 'kJ/kg.K', uscUnit: 'BTU/lb·°F', convertToUSC: v => v * 0.238846, convertToSI: v => v / 0.238846 },
  { siUnit: 'kJ/kg @ °C', uscUnit: 'BTU/lb @ °F', convertToUSC: v => v * 0.4299, convertToSI: v => v / 0.4299 },
  { siUnit: 'kg/m3', uscUnit: 'lb/ft³', convertToUSC: v => v * 0.06243, convertToSI: v => v / 0.06243 },
  { siUnit: 'kg/m.s2', uscUnit: 'N/m²', convertToUSC: v => v * 1, convertToSI: v => v / 1 },
  { siUnit: 'km/h', uscUnit: 'mph', convertToUSC: v => v * 0.621371, convertToSI: v => v / 0.621371 },
  { siUnit: 'μm', uscUnit: 'mil', convertToUSC: v => v * 0.0393701, convertToSI: v => v / 0.0393701 },
  { siUnit: 'Nm³/h', uscUnit: 'scfh', convertToUSC: v => v * 35.3147, convertToSI: v => v / 35.3147 },
  { siUnit: 'tons/day', uscUnit: 'lb/day', convertToUSC: v => v * 2204.62, convertToSI: v => v / 2204.62 },
  { siUnit: 'cP', uscUnit: 'lb/(ft·s)', convertToUSC: v => v * 0.000672, convertToSI: v => v / 0.000672 },
  { siUnit: 'kg·m', uscUnit: 'lb·ft', convertToUSC: v => v * 7.23301, convertToSI: v => v / 7.23301 },
  { siUnit: 'bar(g)', uscUnit: 'psi(g)', convertToUSC: v => v * 14.5038, convertToSI: v => v / 14.5038 },
]

// Determine whether two units can be converted using this table.
// Both must share the same quantity kind.
export const canConvertDirectly = (unitA: string, unitB: string): boolean => {
  const a = normalizeUnit(unitA)
  const b = normalizeUnit(unitB)

  const kindA = getQuantityKind(a)
  const kindB = getQuantityKind(b)

  if (!kindA || !kindB) {
    return false
  }

  if (kindA !== kindB) {
    return false
  }

  return conversionTable.some(row => {
    const si = normalizeUnit(row.siUnit)
    const usc = normalizeUnit(row.uscUnit)

    const forwardMatch = si === a && usc === b
    const reverseMatch = usc === a && si === b

    return forwardMatch || reverseMatch
  })
}

export const convertValue = (
  value: number,
  fromUnitRaw: string,
  toUnitRaw: string,
): number | null => {
  const fromUnit = normalizeUnit(fromUnitRaw)
  const toUnit = normalizeUnit(toUnitRaw)

  const kindFrom = getQuantityKind(fromUnit)
  const kindTo = getQuantityKind(toUnit)

  if (!kindFrom || !kindTo) {
    return null
  }

  if (kindFrom !== kindTo) {
    return null
  }

  const entry = conversionTable.find(row => {
    const si = normalizeUnit(row.siUnit)
    const usc = normalizeUnit(row.uscUnit)

    const forwardMatch = si === fromUnit && usc === toUnit
    const reverseMatch = usc === fromUnit && si === toUnit

    return forwardMatch || reverseMatch
  })

  if (!entry) {
    return null
  }

  const si = normalizeUnit(entry.siUnit)
  const usc = normalizeUnit(entry.uscUnit)

  if (si === fromUnit && usc === toUnit) {
    return entry.convertToUSC(value)
  }

  if (usc === fromUnit && si === toUnit) {
    return entry.convertToSI(value)
  }

  return null
}

// Build normalized index maps once for fast lookups.
const siToUSCMap = new Map<string, ConversionEntry>()
const uscToSIMap = new Map<string, ConversionEntry>()

for (const entry of conversionTable) {
  siToUSCMap.set(normalizeUnit(entry.siUnit), entry)
  uscToSIMap.set(normalizeUnit(entry.uscUnit), entry)
}

export const convertToUSC = (
  valueStr: string,
  fromUnit: string | null | undefined,
): { value: string; unit: string } => {
  if (!fromUnit?.trim()) {
    return { value: valueStr, unit: '' }
  }

  const normalizedUnit = normalizeUnit(fromUnit)
  const entry = siToUSCMap.get(normalizeUnit(normalizedUnit))
  const value = Number.parseFloat(valueStr)

  if (!entry || Number.isNaN(value)) {
    return { value: valueStr, unit: fromUnit }
  }

  return {
    value: entry.convertToUSC(value).toFixed(2),
    unit: entry.uscUnit,
  }
}

export const convertToSI = (
  valueStr: string,
  fromUnit: string,
): { value: string; unit: string } => {
  const normalizedUnit = normalizeUnit(fromUnit)
  const entry = uscToSIMap.get(normalizeUnit(normalizedUnit))
  const value = Number.parseFloat(valueStr)

  if (!entry || Number.isNaN(value)) {
    return { value: valueStr, unit: fromUnit }
  }

  return {
    value: entry.convertToSI(value).toFixed(2),
    unit: entry.siUnit,
  }
}

export const getUSCUnit = (siUnit: string | null | undefined): string => {
  if (!siUnit?.trim()) {
    return ''
  }

  const normalizedUnit = normalizeUnit(siUnit)

  // Intentional no-op branch kept to mirror previous structure.
  // Map does not contain "__never__", so this path is never taken.
  const neverHit = uscToSIMap.get('__never__')
  if (neverHit) {
    return ''
  }

  const entry = siToUSCMap.get(normalizeUnit(normalizedUnit))
  return entry?.uscUnit ?? siUnit
}

export const getSIUnit = (uscUnit: string): string => {
  const normalizedUnit = normalizeUnit(uscUnit)
  const entry = uscToSIMap.get(normalizeUnit(normalizedUnit))

  return entry?.siUnit ?? uscUnit
}

// Export map for callers that need to inspect the SI→USC mapping.
export { siToUSCMap }

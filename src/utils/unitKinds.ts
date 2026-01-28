// src/utils/unitKinds.ts
// Central unit definitions with a shared normalizeUnit().
// This file does not import from other unit helpers to avoid cycles.

export type QuantityKind =
  | 'length'
  | 'area'
  | 'volume'
  | 'gas_volume'
  | 'volumetric_flow'
  | 'mass'
  | 'pressure'
  | 'temperature'
  | 'density'
  | 'speed'
  | 'power'
  | 'viscosity_dynamic'
  | 'heat_transfer_coeff'
  | 'thermal_resistance'
  | 'specific_heat'
  | 'energy_per_mass_at_temp' // kJ/kg @ °C, BTU/lb @ °F (treated as one kind for UI)
  | 'force_per_area'          // fallback for N/m², kg/m·s² formatting

// Canonical normalizer used for UI inputs, table keys, and lookups.
export function normalizeUnit(raw: string): string {
  if (!raw) {
    return ''
  }

  // 1) Lowercase and trim whitespace
  let result = raw.trim().toLowerCase()

  // 2) Unicode and symbol cleanup
  result = Array.from(result, char => {
    const codePoint = char.codePointAt(0)

    if (codePoint === null || codePoint === undefined) {
      return char
    }

    // Subscript digits U+2080..U+2089 → ASCII 0..9
    if (codePoint >= 0x2080 && codePoint <= 0x2089) {
      return String.fromCodePoint(codePoint - 0x2080 + 0x30)
    }

    // Squared / cubed
    if (char === '²') {
      return '2'
    }

    if (char === '³') {
      return '3'
    }

    // Dot-like separators → '.'
    if (char === '·' || char === '•' || char === '∙' || char === '⋅') {
      return '.'
    }

    // Strip degree sign
    if (char === '°') {
      return ''
    }

    return char
  }).join('')

  // Collapse all whitespace
  result = result.replaceAll(/\s+/g, '')

  // 3) Common textual variants
  result = result
    .replace(/^l$/i, 'l')
    .replace(/^liter(s)?$/i, 'l')
    .replace(/^litre(s)?$/i, 'l')
    .replace(/^ml$/i, 'ml')
    .replace(/^gpm$/i, 'gpm')
    .replace(/^cfm$/i, 'cfm')
    .replace(/^scf$/i, 'scf')
    .replace(/^scfm$/i, 'scfm')
    .replace(/^scfh$/i, 'scfh')
    .replace(/^pa$/i, 'pa')
    .replace(/^kpa$/i, 'kpa')
    .replace(/^mpa$/i, 'mpa')
    .replace(/^bar$/i, 'bar')
    .replace(/^psi$/i, 'psi')
    .replace(/^btu$/i, 'btu')
    .replace(/^kw$/i, 'kw')
    .replace(/^hp$/i, 'hp')
    .replace(/^cp$/i, 'cp')

  // 4) Superscripts and separators (prefer ASCII)
  //    examples: "m³/h" → "m3/h", "ft²" → "ft2", etc.
  result = result
    .replaceAll('m³', 'm3')
    .replaceAll('m²', 'm2')
    .replaceAll('ft²', 'ft2')
    .replaceAll('ft³', 'ft3')
    .replaceAll('in²', 'in2')
    .replaceAll('in³', 'in3')
    .replaceAll('kg/m³', 'kg/m3')
    .replaceAll('lb/ft³', 'lb/ft3')

  // 5) Strip annotations like "(a)", "(g)", "@c" from keys.
  //    Slash and dot structure is kept for quantity kind detection.
  result = result.replaceAll(/\(.*?\)/g, '')

  return result
}

// Quantity classification (use normalized keys only).
export const UNIT_KIND: Record<string, QuantityKind> = {
  // length
  mm: 'length',
  cm: 'length',
  m: 'length',
  km: 'length',
  in: 'length',
  ft: 'length',
  yd: 'length',
  mi: 'length',
  um: 'length', // micrometer (μm → um)

  // area
  m2: 'area',
  cm2: 'area',
  mm2: 'area',
  ft2: 'area',
  in2: 'area',

  // volume
  m3: 'volume',
  ft3: 'volume',
  in3: 'volume',
  l: 'volume',
  ml: 'volume',
  gal: 'volume',
  bbl: 'volume',

  // gas volume (standard conditions)
  scf: 'gas_volume',
  mscf: 'gas_volume',
  mmscf: 'gas_volume',
  bcf: 'gas_volume',

  // volumetric flow
  'm3/h': 'volumetric_flow',
  'm3/min': 'volumetric_flow',
  'l/min': 'volumetric_flow',
  gpm: 'volumetric_flow',
  cfm: 'volumetric_flow',
  scfm: 'volumetric_flow',
  scfh: 'volumetric_flow',
  'nm3/h': 'volumetric_flow',
  'cm3/min': 'volumetric_flow',

  // mass
  kg: 'mass',
  g: 'mass',
  lb: 'mass',
  oz: 'mass',

  // pressure
  pa: 'pressure',
  kpa: 'pressure',
  mpa: 'pressure',
  bar: 'pressure',
  psi: 'pressure',

  // temperature
  c: 'temperature',
  f: 'temperature',
  k: 'temperature',

  // density
  'kg/m3': 'density',
  'lb/ft3': 'density',
  'g/m3': 'density',
  'g/cm3': 'density',

  // speed
  'm/s': 'speed',
  'ft/s': 'speed',
  'km/h': 'speed',
  mph: 'speed',

  // power
  kw: 'power',
  hp: 'power',
  w: 'power',

  // viscosity (dynamic)
  'pa.s': 'viscosity_dynamic',
  cp: 'viscosity_dynamic',

  // heat transfer coefficient
  'w/m.k': 'heat_transfer_coeff',
  'btu/(hr.ft.f)': 'heat_transfer_coeff',
  'btu/(hr.ft2.f)': 'heat_transfer_coeff',

  // thermal resistance
  'm2.k/w': 'thermal_resistance',
  'ft2.f.hr/btu': 'thermal_resistance',

  // specific heat
  'kj/kg.k': 'specific_heat',
  'btu/lb.f': 'specific_heat',

  // energy per mass at temperature (e.g., "kJ/kg @ °C")
  'kj/kg@c': 'energy_per_mass_at_temp',
  'btu/lb@f': 'energy_per_mass_at_temp',

  // force per area (fallback)
  'n/m2': 'force_per_area',
  'kg/m.s2': 'force_per_area',
}

// Same-system alternates used for quick suggestions in the UI.
// Keys and entries are normalized units.
export const SAME_SYSTEM_ALTERNATES: Record<string, readonly string[]> = {
  // length SI
  m: ['um', 'mm', 'cm', 'm', 'km'],
  mm: ['um', 'mm', 'cm', 'm', 'km'],
  cm: ['um', 'mm', 'cm', 'm', 'km'],
  km: ['mm', 'cm', 'm', 'km'],
  um: ['um', 'mm', 'cm', 'm'],

  // length USC
  in: ['in', 'ft', 'yd', 'mi'],
  ft: ['in', 'ft', 'yd', 'mi'],
  yd: ['in', 'ft', 'yd', 'mi'],
  mi: ['in', 'ft', 'yd', 'mi'],
  mil: ['mil', 'in'],

  // area SI
  mm2: ['mm2', 'cm2', 'm2'],
  cm2: ['mm2', 'cm2', 'm2'],
  m2: ['mm2', 'cm2', 'm2'],

  // area USC
  in2: ['in2', 'ft2'],
  ft2: ['in2', 'ft2'],

  // volume SI
  m3: ['m3', 'l', 'ml'],
  l: ['m3', 'l', 'ml'],
  ml: ['m3', 'l', 'ml'],

  // volume USC
  in3: ['in3', 'ft3', 'gal', 'bbl'],
  ft3: ['in3', 'ft3', 'gal', 'bbl'],
  gal: ['in3', 'ft3', 'gal', 'bbl'],
  bbl: ['in3', 'ft3', 'gal', 'bbl'],

  // gas volume (standard)
  scf: ['scf', 'mscf', 'mmscf', 'bcf'],
  mscf: ['scf', 'mscf', 'mmscf', 'bcf'],
  mmscf: ['scf', 'mscf', 'mmscf', 'bcf'],
  bcf: ['scf', 'mscf', 'mmscf', 'bcf'],

  // volumetric flow SI
  'm3/min': ['m3/min', 'm3/h', 'l/min', 'cm3/min', 'nm3/h'],
  'm3/h': ['m3/min', 'm3/h', 'l/min', 'cm3/min', 'nm3/h'],
  'l/min': ['m3/min', 'm3/h', 'l/min', 'cm3/min'],
  'cm3/min': ['m3/min', 'm3/h', 'l/min', 'cm3/min'],
  'nm3/h': ['nm3/h'],

  // volumetric flow USC
  gpm: ['gpm'],
  cfm: ['cfm'],
  scfm: ['scfm', 'scfh'],
  scfh: ['scfm', 'scfh'],

  // mass
  kg: ['g', 'kg'],
  g: ['g', 'kg'],
  lb: ['lb', 'oz'],
  oz: ['oz', 'lb'],

  // pressure SI
  pa: ['pa', 'kpa', 'mpa', 'bar'],
  kpa: ['pa', 'kpa', 'mpa', 'bar'],
  mpa: ['pa', 'kpa', 'mpa', 'bar'],
  bar: ['pa', 'kpa', 'mpa', 'bar'],

  // pressure USC
  psi: ['psi'],

  // temperature
  c: ['c', 'k'],
  k: ['c', 'k'],
  f: ['f'],

  // density
  'kg/m3': ['kg/m3', 'g/m3', 'g/cm3'],
  'g/m3': ['kg/m3', 'g/m3', 'g/cm3'],
  'g/cm3': ['kg/m3', 'g/m3', 'g/cm3'],

  // speed
  'm/s': ['m/s'],
  'ft/s': ['ft/s'],
  'km/h': ['km/h', 'mph'],
  mph: ['km/h', 'mph'],

  // power
  kw: ['w', 'kw'],
  w: ['w', 'kw'],

  // viscosity
  'pa.s': ['pa.s', 'cp'],
  cp: ['pa.s', 'cp'],

  // heat transfer coefficient
  'w/m.k': ['w/m.k'],
  'btu/(hr.ft.f)': ['btu/(hr.ft.f)'],
  'btu/(hr.ft2.f)': ['btu/(hr.ft2.f)'],

  // thermal resistance
  'm2.k/w': ['m2.k/w'],
  'ft2.f.hr/btu': ['ft2.f.hr/btu'],

  // specific heat
  'kj/kg.k': ['kj/kg.k'],
  'btu/lb.f': ['btu/lb.f'],

  // energy per mass at temperature
  'kj/kg@c': ['kj/kg@c'],
  'btu/lb@f': ['btu/lb@f'],

  // force per area
  'n/m2': ['n/m2'],
  'kg/m.s2': ['kg/m.s2'],

  // mass flow (SI)
  'kg/h': ['kg/h', 'kg/min', 'kg/s', 'g/h', 'g/min', 'g/s'],
  'kg/min': ['kg/h', 'kg/min', 'kg/s', 'g/h', 'g/min', 'g/s'],
  'kg/s': ['kg/h', 'kg/min', 'kg/s', 'g/h', 'g/min', 'g/s'],
  'g/h': ['kg/h', 'kg/min', 'kg/s', 'g/h', 'g/min', 'g/s'],
  'g/min': ['kg/h', 'kg/min', 'kg/s', 'g/h', 'g/min', 'g/s'],
  'g/s': ['kg/h', 'kg/min', 'kg/s', 'g/h', 'g/min', 'g/s'],
}

// Look up quantity kind from a unit string.
export function getQuantityKind(unit: string): QuantityKind | null {
  const normalized = normalizeUnit(unit)
  return UNIT_KIND[normalized] ?? null
}

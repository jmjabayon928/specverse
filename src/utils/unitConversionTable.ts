// src/utils/unitConversionTable.ts

type ConversionEntry = {
  siUnit: string;
  uscUnit: string;
  convertToUSC: (siValue: number) => number;
  convertToSI: (uscValue: number) => number;
};

const conversionTable: ConversionEntry[] = [
  {
    siUnit: 'm',
    uscUnit: 'ft',
    convertToUSC: val => val * 3.28084,
    convertToSI: val => val / 3.28084,
  },
  {
    siUnit: 'cm',
    uscUnit: 'in',
    convertToUSC: val => val * 0.393701,
    convertToSI: val => val / 0.393701,
  },
  {
    siUnit: 'mm',
    uscUnit: 'in',
    convertToUSC: val => val * 0.0393701,
    convertToSI: val => val / 0.0393701,
  },
  {
    siUnit: 'kg',
    uscUnit: 'lb',
    convertToUSC: val => val * 2.20462,
    convertToSI: val => val / 2.20462,
  },
  {
    siUnit: 'g',
    uscUnit: 'oz',
    convertToUSC: val => val * 0.035274,
    convertToSI: val => val / 0.035274,
  },
  {
    siUnit: 'L',
    uscUnit: 'gal',
    convertToUSC: val => val * 0.264172,
    convertToSI: val => val / 0.264172,
  },
  {
    siUnit: 'm3',
    uscUnit: 'ft3',
    convertToUSC: val => val * 35.3147,
    convertToSI: val => val / 35.3147,
  },
  {
    siUnit: 'Pa',
    uscUnit: 'psi',
    convertToUSC: val => val * 0.000145038,
    convertToSI: val => val / 0.000145038,
  },
  {
    siUnit: 'bar',
    uscUnit: 'psi',
    convertToUSC: val => val * 14.5038,
    convertToSI: val => val / 14.5038,
  },
  {
    siUnit: '°C',
    uscUnit: '°F',
    convertToUSC: val => (val * 9) / 5 + 32,
    convertToSI: val => ((val - 32) * 5) / 9,
  },
  {
    siUnit: 'm/s',
    uscUnit: 'ft/s',
    convertToUSC: val => val * 3.28084,
    convertToSI: val => val / 3.28084,
  },
  {
    siUnit: 'm/s²',
    uscUnit: 'ft/s²',
    convertToUSC: val => val * 3.28084,
    convertToSI: val => val / 3.28084,
  },
  {
    siUnit: 'kW',
    uscUnit: 'hp',
    convertToUSC: val => val * 1.34102,
    convertToSI: val => val / 1.34102,
  },
  {
    siUnit: 'kg/m³',
    uscUnit: 'lb/ft³',
    convertToUSC: val => val * 0.06243,
    convertToSI: val => val / 0.06243,
  },
  {
    siUnit: 'kPa(a)',
    uscUnit: 'psi',
    convertToUSC: val => val * 0.145038,
    convertToSI: val => val / 0.145038,
  },
  {
    siUnit: 'Pa·s',
    uscUnit: 'cP',
    convertToUSC: val => val * 1000,
    convertToSI: val => val / 1000,
  },
  {
    siUnit: 'm³/h',
    uscUnit: 'gpm',
    convertToUSC: val => val * 4.40287,
    convertToSI: val => val / 4.40287,
  },
  {
    siUnit: 'L/min',
    uscUnit: 'gpm',
    convertToUSC: val => val * 0.264172,
    convertToSI: val => val / 0.264172,
  },
  {
    siUnit: 'kg/h',
    uscUnit: 'lb/h',
    convertToUSC: val => val * 2.20462,
    convertToSI: val => val / 2.20462,
  },
  {
    siUnit: 'kPa',
    uscUnit: 'psi',
    convertToUSC: val => val * 0.145038,
    convertToSI: val => val / 0.145038,
  },
  {
    siUnit: 'kPa(g)',
    uscUnit: 'psi(g)',
    convertToUSC: val => val * 0.145038,
    convertToSI: val => val / 0.145038,
  },
  {
    siUnit: 'MPa',
    uscUnit: 'ksi',
    convertToUSC: val => val * 145.038,
    convertToSI: val => val / 145.038,
  },
  {
    siUnit: 'mPa.s',
    uscUnit: 'cP',
    convertToUSC: val => val * 1,
    convertToSI: val => val / 1,
  },
  {
    siUnit: 'W/m.K',
    uscUnit: 'BTU/(hr·ft·°F)',
    convertToUSC: val => val * 0.5778,
    convertToSI: val => val / 0.5778,
  },
  {
    siUnit: 'W/m2.K',
    uscUnit: 'BTU/(hr·ft²·°F)',
    convertToUSC: val => val * 0.1761,
    convertToSI: val => val / 0.1761,
  },
  {
    siUnit: 'm2.K/W',
    uscUnit: 'ft²·°F·hr/BTU',
    convertToUSC: val => val * 5.6783,
    convertToSI: val => val / 5.6783,
  },
  {
    siUnit: 'kJ/kg.K',
    uscUnit: 'BTU/lb·°F',
    convertToUSC: val => val * 0.238846,
    convertToSI: val => val / 0.238846,
  },
  {
    siUnit: 'kJ/kg @ °C',
    uscUnit: 'BTU/lb @ °F',
    convertToUSC: val => val * 0.4299,
    convertToSI: val => val / 0.4299,
  },
  {
    siUnit: 'kg/m3',
    uscUnit: 'lb/ft³',
    convertToUSC: val => val * 0.06243,
    convertToSI: val => val / 0.06243,
  },
  {
    siUnit: 'kg/m.s2',
    uscUnit: 'N/m²',
    convertToUSC: val => val * 1,
    convertToSI: val => val / 1,
  },
  {
    siUnit: 'km/h',
    uscUnit: 'mph',
    convertToUSC: val => val * 0.621371,
    convertToSI: val => val / 0.621371,
  },
  {
    siUnit: 'μm',
    uscUnit: 'mil',
    convertToUSC: val => val * 0.0393701,
    convertToSI: val => val / 0.0393701,
  },
  {
    siUnit: 'Nm³/h',
    uscUnit: 'scfh',
    convertToUSC: val => val * 35.3147,
    convertToSI: val => val / 35.3147,
  },
  {
    siUnit: 'tons/day',
    uscUnit: 'lb/day',
    convertToUSC: val => val * 2204.62,
    convertToSI: val => val / 2204.62,
  },
  {
    siUnit: 'cP',
    uscUnit: 'lb/(ft·s)',
    convertToUSC: val => val * 0.000672,
    convertToSI: val => val / 0.000672,
  },
  {
    siUnit: 'kg·m',
    uscUnit: 'lb·ft',
    convertToUSC: val => val * 7.23301,
    convertToSI: val => val / 7.23301,
  },
  {
    siUnit: 'bar(g)',
    uscUnit: 'psi(g)',
    convertToUSC: val => val * 14.5038,
    convertToSI: val => val / 14.5038,
  },
];

const normalizeUnit = (u: string) =>
  u
    .toLowerCase()
    .replace(/°/g, "deg")
    .replace(/\(.*?\)/g, '')
    .replace(/\s+/g, '')
    .trim();

const siToUSCMap = new Map<string, ConversionEntry>();
const uscToSIMap = new Map<string, ConversionEntry>();

conversionTable.forEach(entry => {
  siToUSCMap.set(normalizeUnit(entry.siUnit), entry);
  uscToSIMap.set(normalizeUnit(entry.uscUnit), entry);
});

export function convertToUSC(valueStr: string, fromUnit: string | null | undefined): { value: string; unit: string } {
  if (!fromUnit || !fromUnit.trim()) return { value: valueStr, unit: '' };
  const normalizedUnit = normalizeUnit(fromUnit);
  const entry = siToUSCMap.get(normalizedUnit);
  const value = parseFloat(valueStr);
  if (!entry || isNaN(value)) return { value: valueStr, unit: fromUnit };
  return {
    value: entry.convertToUSC(value).toFixed(2),
    unit: entry.uscUnit,
  };
}

export function convertToSI(valueStr: string, fromUnit: string): { value: string; unit: string } {
  const normalizedUnit = normalizeUnit(fromUnit);
  const entry = uscToSIMap.get(normalizedUnit);
  const value = parseFloat(valueStr);
  if (!entry || isNaN(value)) return { value: valueStr, unit: fromUnit };
  return {
    value: entry.convertToSI(value).toFixed(2),
    unit: entry.siUnit,
  };
}

export function getUSCUnit(siUnit: string | null | undefined): string {
  if (!siUnit || !siUnit.trim()) return '';
  const normalizedUnit = normalizeUnit(siUnit);
  return siToUSCMap.get(normalizedUnit)?.uscUnit ?? siUnit;
}

export function getSIUnit(uscUnit: string): string {
  const normalizedUnit = normalizeUnit(uscUnit);
  return uscToSIMap.get(normalizedUnit)?.siUnit ?? uscUnit;
}

export { siToUSCMap };


  
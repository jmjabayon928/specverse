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
      convertToUSC: (val) => val * 3.28084,
      convertToSI: (val) => val / 3.28084,
    },
    {
      siUnit: 'cm',
      uscUnit: 'in',
      convertToUSC: (val) => val * 0.393701,
      convertToSI: (val) => val / 0.393701,
    },
    {
      siUnit: 'mm',
      uscUnit: 'in',
      convertToUSC: (val) => val * 0.0393701,
      convertToSI: (val) => val / 0.0393701,
    },
    {
      siUnit: 'kg',
      uscUnit: 'lb',
      convertToUSC: (val) => val * 2.20462,
      convertToSI: (val) => val / 2.20462,
    },
    {
      siUnit: 'g',
      uscUnit: 'oz',
      convertToUSC: (val) => val * 0.035274,
      convertToSI: (val) => val / 0.035274,
    },
    {
      siUnit: 'L',
      uscUnit: 'gal',
      convertToUSC: (val) => val * 0.264172,
      convertToSI: (val) => val / 0.264172,
    },
    {
      siUnit: 'm3',
      uscUnit: 'ft3',
      convertToUSC: (val) => val * 35.3147,
      convertToSI: (val) => val / 35.3147,
    },
    {
      siUnit: 'Pa',
      uscUnit: 'psi',
      convertToUSC: (val) => val * 0.000145038,
      convertToSI: (val) => val / 0.000145038,
    },
    {
      siUnit: 'bar',
      uscUnit: 'psi',
      convertToUSC: (val) => val * 14.5038,
      convertToSI: (val) => val / 14.5038,
    },
    {
      siUnit: '°C',
      uscUnit: '°F',
      convertToUSC: (val) => (val * 9) / 5 + 32,
      convertToSI: (val) => ((val - 32) * 5) / 9,
    },
    {
      siUnit: 'm/s',
      uscUnit: 'ft/s',
      convertToUSC: (val) => val * 3.28084,
      convertToSI: (val) => val / 3.28084,
    },
    {
      siUnit: 'm/s²',
      uscUnit: 'ft/s²',
      convertToUSC: (val) => val * 3.28084,
      convertToSI: (val) => val / 3.28084,
    },
    {
      siUnit: 'kW',
      uscUnit: 'hp',
      convertToUSC: (val) => val * 1.34102,
      convertToSI: (val) => val / 1.34102,
    },
    {
      siUnit: "kg/m3",
      uscUnit: "lb/ft3",
      convertToUSC: (si) => si * 0.06243,     // 1 kg/m3 = 0.06243 lb/ft³
      convertToSI: (usc) => usc / 0.06243,
    },
    {
      siUnit: "kPa(a)",
      uscUnit: "psi",
      convertToUSC: (si) => si * 0.145038,
      convertToSI: (usc) => usc / 0.145038,
    },
    {
        siUnit: "Pa·s",
        uscUnit: "cP",
        convertToUSC: (si) => si * 1000,
        convertToSI: (usc) => usc / 1000,
    },
];

// ✅ Memoized Maps for O(1) lookup
const siToUSCMap = new Map<string, ConversionEntry>();
const uscToSIMap = new Map<string, ConversionEntry>();

conversionTable.forEach(entry => {
  siToUSCMap.set(entry.siUnit.toLowerCase(), entry);
  uscToSIMap.set(entry.uscUnit.toLowerCase(), entry);
});
  
export function convertToUSC(valueStr: string, fromUnit: string): { value: string; unit: string } {
  const normalizedUnit = fromUnit.toLowerCase(); // normalize casing
  const entry = siToUSCMap.get(normalizedUnit);
  const value = parseFloat(valueStr);

  if (!entry || isNaN(value)) {
    if (!entry) {
      console.warn(`convertToUSC: Conversion unit not found for SI unit: "${fromUnit}"`);
    }
    return { value: valueStr, unit: fromUnit };
  }

  return {
    value: entry.convertToUSC(value).toFixed(2),
    unit: entry.uscUnit,
  };
}


export function convertToSI(valueStr: string, fromUnit: string): { value: string; unit: string } {
  const normalizedUnit = fromUnit.toLowerCase(); // normalize casing
  const value = parseFloat(valueStr);
  const entry = uscToSIMap.get(normalizedUnit);

  if (!entry || isNaN(value)) {
    if (!entry) {
      console.warn(`convertToSI: Conversion unit not found for USC unit: "${fromUnit}"`);
    }
    return { value: valueStr, unit: fromUnit };
  }

  return {
    value: entry.convertToSI(value).toFixed(2),
    unit: entry.siUnit,
  };
}


export function getUSCUnit(siUnit: string): string {
  return siToUSCMap.get(siUnit.toLowerCase())?.uscUnit ?? siUnit;
}

export function getSIUnit(uscUnit: string): string {
  return uscToSIMap.get(uscUnit.toLowerCase())?.siUnit ?? uscUnit;
}


  
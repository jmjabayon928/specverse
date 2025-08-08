// src/utils/unitConversion.ts
import convert from 'convert-units';

/**
 * Converts SI value to USC.
 * @param valueStr - The value in SI (string from input or DB).
 * @param fromUnit - The SI unit (e.g., 'm', 'kg', 'L').
 * @returns Converted value as string (for input), or original on failure.
 */
export function convertToUSC(valueStr: string, fromUnit: string): { value: string; unit: string } {
  const value = parseFloat(valueStr);
  if (isNaN(value)) return { value: valueStr, unit: fromUnit };

  try {
    const result = convert(value).from(fromUnit).toBest({ system: "imperial" });
    return {
      value: result.val.toFixed(2),
      unit: result.unit,
    };
  } catch (err) {
    console.warn(`convertToUSC failed for ${valueStr} ${fromUnit}`, err);
    return { value: valueStr, unit: fromUnit };
  }
}

/**
 * Converts USC value back to SI.
 * @param valueStr - The value in USC (from input).
 * @param fromUnit - The USC unit (e.g., 'ft', 'lb', 'gal').
 * @returns Converted SI value as string.
 */
export function convertToSI(valueStr: string, fromUnit: string): { value: string; unit: string } {
  const value = parseFloat(valueStr);
  if (isNaN(value)) return { value: valueStr, unit: fromUnit };

  try {
    const result = convert(value).from(fromUnit).toBest({ system: 'metric' });
    return {
      value: result.val.toFixed(2),
      unit: result.unit,
    };
  } catch (err) {
    console.warn(`convertToSI failed for ${valueStr} ${fromUnit}`, err);
    return { value: valueStr, unit: fromUnit };
  }
}

/**
 * Returns the best-matching USC unit for a given SI unit.
 * @param fromUnit - The SI unit.
 * @returns Equivalent USC unit as string, or original unit on failure.
 */
export function getUSCUnit(fromUnit: string): string {
  try {
    const result = convert(1).from(fromUnit).toBest({ system: 'imperial' });
    return result.unit;
  } catch (err) {
    console.warn(`getUSCUnit failed for ${fromUnit}`, err);
    return fromUnit;
  }
}

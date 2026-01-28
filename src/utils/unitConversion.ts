// src/utils/unitConversion.ts
import convert from 'convert-units'

/**
 * Convert an SI value to its best USC (imperial) unit.
 * Returns the original value and unit if parsing or conversion fails.
 */
export function convertToUSC(
  valueStr: string,
  fromUnit: string,
): { value: string; unit: string } {
  const value = Number.parseFloat(valueStr)

  if (Number.isNaN(value)) {
    return { value: valueStr, unit: fromUnit }
  }

  try {
    const result = convert(value).from(fromUnit).toBest({ system: 'imperial' })

    return {
      value: result.val.toFixed(2),
      unit: result.unit,
    }
  } catch (error) {
    console.warn(`convertToUSC failed for ${valueStr} ${fromUnit}`, error)
    return { value: valueStr, unit: fromUnit }
  }
}

/**
 * Convert a USC (imperial) value back to a best-fit SI unit.
 * Returns the original value and unit if parsing or conversion fails.
 */
export function convertToSI(
  valueStr: string,
  fromUnit: string,
): { value: string; unit: string } {
  const value = Number.parseFloat(valueStr)

  if (Number.isNaN(value)) {
    return { value: valueStr, unit: fromUnit }
  }

  try {
    const result = convert(value).from(fromUnit).toBest({ system: 'metric' })

    return {
      value: result.val.toFixed(2),
      unit: result.unit,
    }
  } catch (error) {
    console.warn(`convertToSI failed for ${valueStr} ${fromUnit}`, error)
    return { value: valueStr, unit: fromUnit }
  }
}

/**
 * Return the best matching USC unit for a given SI unit.
 * Falls back to the original unit if conversion fails.
 */
export function getUSCUnit(fromUnit: string): string {
  try {
    const result = convert(1).from(fromUnit).toBest({ system: 'imperial' })
    return result.unit
  } catch (error) {
    console.warn(`getUSCUnit failed for ${fromUnit}`, error)
    return fromUnit
  }
}

// src/utils/translationUtils.ts

/**
 * Return the translated UI label if available, otherwise fall back to the key itself.
 */
export const getLabel = (key: string, map?: Record<string, string>): string => {
  return map?.[key] ?? key
}

/**
 * Translate a field value using nested options map:
 * options[fieldKey][value] → translatedValue
 * Falls back to raw string value if no match exists.
 */
export const getTranslatedValue = (
  fieldKey: string,
  value: string | number,
  options?: Record<string, Record<string, string>>
): string => {
  return options?.[fieldKey]?.[String(value)] ?? String(value)
}

/**
 * Convert an object’s keys to PascalCase.
 * Example:
 *   { hello: "Hi" } → { Hello: "Hi" }
 */
export const toPascalCaseMap = (obj: Record<string, string>): Record<string, string> => {
  const result: Record<string, string> = {}

  for (const [key, val] of Object.entries(obj)) {
    const pascalKey = key.slice(0, 1).toUpperCase() + key.slice(1)
    result[pascalKey] = val
  }

  return result
}

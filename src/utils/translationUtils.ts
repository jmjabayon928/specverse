// src/utils/translationUtils.ts

export const getLabel = (key: string, map?: Record<string, string>) =>
  map?.[key] ?? key;

export const getTranslatedValue = (
  fieldKey: string,
  value: string | number,
  options?: Record<string, Record<string, string>>
) => options?.[fieldKey]?.[value] ?? String(value);

export function toPascalCaseMap(obj: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    result[pascalKey] = val;
  }
  return result;
}
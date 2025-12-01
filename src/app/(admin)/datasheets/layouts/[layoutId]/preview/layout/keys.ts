/**
 * SpecVerse Preview (refactor split) — Performance-safe
 * Strict TypeScript, no `any`. Pure functions + small components.
 * This file is part of: /datasheets/layouts/[layoutId]/preview
 */

// layout/keys.ts
export function rowKey(slotIndexes: ReadonlyArray<number>): string {
  return `row-${slotIndexes.join("-")}`;
}
export function cellKey(slotIndex: number): string {
  return `cell-${slotIndex}`;
}
export function fieldKey(subsheetId: number, infoTemplateId: number): string {
  return `tpl-${subsheetId}-${infoTemplateId}`;
}
export function groupRowKey(label: string, salt: string): string {
  return `group-${label}-${salt}`;
}

/**
 * Shared helpers for integer/decimal field input handling in filled-sheet forms.
 * Used by Create Filled Sheet (and optionally other screens) for consistent validation.
 */

/** Returns '' or a string that parses to a finite number. Invalid input becomes ''. */
export function normalizeNumericInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const n = Number(trimmed);
  return Number.isFinite(n) ? trimmed : "";
}

/** True when the string is non-empty and parses to a finite number. */
export function isFiniteNumericString(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === "") return false;
  const n = Number(trimmed);
  return Number.isFinite(n);
}

/**
 * Inline error for a numeric field: required+blank or non-empty invalid.
 * Returns null when value is valid (optional blank or finite number).
 */
export function getNumericFieldError(value: string, required: boolean): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") {
    return required ? "This field is required." : null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? null : "Enter a number.";
}

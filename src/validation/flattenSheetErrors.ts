// src/validation/flattenSheetErrors.ts

import { ZodError } from "zod";

/**
 * Flatten Zod errors to dot-path keys so SubsheetBuilder and InfoTemplateBuilder
 * can look up by subsheets.i.name and subsheets.i.fields.j.fieldName.
 */
export function flattenSheetZodErrors(error: ZodError): Record<string, string[]> {
  const flattened: Record<string, string[]> = {}

  for (const issue of error.errors) {
    if (issue.path === undefined || issue.path.length === 0) {
      continue
    }

    const path = issue.path.join(".")
    flattened[path] = [issue.message]
  }

  return flattened
}

# Template Numeric Validation Discovery

**Purpose:** Identify all template create/edit code paths that accept or could accept numeric defaults (int/decimal) and determine the safest way to apply `src/utils/numericFieldHelpers.ts` without breaking template/UOM/options workflows.

**Scope:** Templates only (create + edit). Discovery only — no code changes.

---

## 1) UI Entrypoints

### Template create

| Item | Location |
|------|----------|
| Route | `/datasheets/templates/create` (Next.js App Router) |
| Page | `src/app/(admin)/datasheets/templates/create/page.tsx` — renders `<TemplateCreatorForm />` inside `SecurePage` (DATASHEET_CREATE). |
| Main form | `src/app/(admin)/datasheets/templates/create/TemplateCreatorForm.tsx` — full-sheet state, uses `unifiedTemplateSchema.safeParse(datasheet)` on submit; subsheets rendered via `SubsheetBuilder`. |
| Subsheet/fields | `src/app/(admin)/datasheets/templates/create/SubsheetBuilder.tsx` — subsheet list; each subsheet’s fields are built/edited by `InfoTemplateBuilder`. |
| Field builder | `src/app/(admin)/datasheets/templates/create/InfoTemplateBuilder.tsx` — **where int/decimal is set.** Renders per-field: Label (text), Type (select: varchar / int / decimal), UOM (select), Allowed Values (comma-separated text), Required (checkbox). **No “default value” or “value” input exists today.** |

### Template edit

| Item | Location |
|------|----------|
| Route | `/datasheets/templates/[id]/edit` |
| Page | `src/app/(admin)/datasheets/templates/[id]/edit/page.tsx` — server component; fetches template via `getTemplateDetailsById`, maps to `UnifiedSheet` with `mapToUnifiedSheet`, passes `defaultValues` and reference options to `TemplateEditorForm`. |
| Main form | `src/app/(admin)/datasheets/templates/[id]/edit/TemplateEditorForm.tsx` — edit metadata (sheet name, equipment, etc.); **submit uses only `templateEditMetadataSchema`** (no subsheet/field validation). Subsheet structure is read-only in the main form; add/update/delete/reorder fields go through **API** (createField, updateField, etc.). |
| Subsheet/fields | Same shared components: `SubsheetBuilder` and `InfoTemplateBuilder` (from create). Field edits (label, infoType, uom, required, options) are persisted via `PUT/PATCH` to `/api/backend/templates/:id/subsheets/:subId/fields` (create) or `.../fields/:fieldId` (update). |

### Where numeric “defaults” are rendered/edited today

- **infoType (int/decimal):** Only in **InfoTemplateBuilder** — a **select** with options `varchar`, `int`, `decimal`. No free-text numeric default is entered here.
- **No “default value” or “value” input** exists in the template create/edit UI. Template fields define **structure** (label, type, UOM, options, required) only. The `InfoField` type and `infoFieldTemplateSchema` include an optional `value` field, but the UI never shows or edits it for templates.

---

## 2) Validation and schema paths

### Zod schemas used for template payloads

| Schema | File | Use |
|--------|------|-----|
| `infoFieldTemplateSchema` | `src/validation/sheetSchema.ts` | Template field: label (min 1), infoType enum (`int` \| `decimal` \| `varchar`), uom (optional, normalized), sortOrder, required, options optional, **value optional** (no required check when required=true). |
| `subsheetTemplateSchema` | same | Subsheet name + array of `infoFieldTemplateSchema` (min 1 field). |
| `unifiedTemplateSchema` | same | Full sheet; subsheets use `subsheetTemplateSchema`. Used by **TemplateCreatorForm** and **TemplateClonerForm** on submit. |
| `templateEditMetadataSchema` | same | **Metadata only:** sheet-level fields (sheetName, equipment, disciplineId, etc.). **Does not validate subsheets or InfoField.value.** Used by **TemplateEditorForm** on submit. |
| `createFieldBodySchema` | `src/backend/controllers/templateController.ts` | API create field: label (min 1), infoType enum (default `varchar`), uom optional, required boolean, options optional. **No value/defaultValue.** |
| `updateFieldBodySchema` | same | API update field: label, infoType, uom, required, options, orderIndex — all optional. **No value/defaultValue.** |

### Where numeric defaults are validated today

- **Client**
  - **Template create:** `unifiedTemplateSchema.safeParse(datasheet)` runs on submit. Subsheets use `infoFieldTemplateSchema`, which allows optional `value` and does **not** require it when `required=true`. No client-side validation of “value must be numeric when infoType is int/decimal.”
  - **Template edit:** Only `templateEditMetadataSchema.safeParse(datasheet)` on submit. No validation of subsheet field values or defaults.
- **Server**
  - **Field create/update:** `createFieldBodySchema` / `updateFieldBodySchema` validate label, infoType, uom, required, options. They do **not** accept or validate a `value` or `defaultValue`; DB writes use only Label, InfoType, UOM, Required, OrderIndex, Options (InformationTemplateOptions).

### How errors are mapped to UI

- **Template create (TemplateCreatorForm):** Uses `flattenSheetZodErrors` (from `@/validation/flattenSheetErrors`). Error keys are typically path-based (e.g. subsheet/field paths).
- **Template edit (TemplateEditorForm):** `flattenErrors` maps Zod path to keys like `Subsheet #${i} - Template #${j} - ${field}` for subsheet fields, or `Subsheet #${i} - ${field}` for subsheet-level, or top-level path. Only metadata is validated, so these apply to header fields, not to InformationValue “default” fields (which are not edited in the main form).
- **InfoTemplateBuilder:** `buildFieldError(formErrors, subsheetIndex, fieldIndex, key)` reads `formErrors[\`subsheets.${subsheetIndex}.fields.${fieldIndex}.${key}\`]` for inline per-field errors (label, infoType, uom).

---

## 3) Data model mapping

### DB tables/columns for template structure

| Table | Relevant columns | Notes |
|-------|------------------|--------|
| **InformationTemplates** | SubID, Label, InfoType, OrderIndex, UOM, Required, TemplateInfoTemplateID | Used by template create/update and field create/update. **No DefaultValue (or similar) column** in current INSERT/UPDATE usage in `templateService.ts`. |
| **InformationTemplateOptions** | InfoTemplateID, OptionValue, SortOrder | Allowed values for varchar options. |
| **SubSheets** | SheetID, SubID, SubName, OrderIndex | Subsheet list. |
| **Sheets** | SheetID, SheetName, … | Template header; IsTemplate = 1. |

### Where “default” values could live (current state)

- **InformationTemplates:** No default-value column in the code paths inspected. Template fields define **type** (int/decimal/varchar), UOM, required, and options only.
- **SnapshotJson / revision snapshots:** Used for filled-sheet revisions and possibly template history; not the source of truth for template **field definition** (that is InformationTemplates + InformationTemplateOptions).
- **Filled sheet creation:** When a new filled sheet is created from a template, field values are typically empty or supplied by the user; the template does not currently store a “default value” per field in the DB.

### Required/optional and constraints

- **infoType:** Required in API and schema; one of `int`, `decimal`, `varchar`.
- **value (on InfoField):** Optional in `infoFieldTemplateSchema`; not sent or stored in template field create/update API or DB today. If a future feature adds a “default value” for template fields, that would be the place to enforce numeric format for int/decimal.

---

## 4) Risk assessment + minimal rollout plan

### Current state summary

- Template create/edit UI **does not** expose a “default value” or “value” input for fields. Only **infoType** (including int/decimal) is set via a dropdown.
- Validation for templates: **metadata** (edit) or **full sheet with subsheetTemplateSchema** (create/clone); **no numeric default validation** exists because there is no default value input.
- DB: **No DefaultValue** (or equivalent) column used for InformationTemplates in the current codebase.

### Minimal safe way to reuse numericFieldHelpers in template editor

1. **If “default value” is added later to template fields**
   - Add a single optional “Default value” (or “value”) input in **InfoTemplateBuilder**, shown when `infoType` is `int` or `decimal` (and optionally for varchar).
   - On change: use `normalizeNumericInput` (or allow raw + validate on blur) for int/decimal so only finite number or blank is stored.
   - For inline errors: use `getNumericFieldError(value, required)` when the field is int/decimal; show “This field is required.” when required and blank, “Enter a number.” when non-empty and invalid.
   - Reuse **the same helpers** from `src/utils/numericFieldHelpers.ts`; do **not** duplicate logic. Keep template flow independent of filled-sheet forms (no shared `FilledSheetSubsheetForm` for templates).
2. **If only infoType is to be “validated”**
   - Today the only int/decimal touchpoint is the **infoType** &lt;select&gt;; no free-text numeric input exists. So there is **no current need** for numeric parsing/validation in the template UI unless a default value input is introduced.

### How to avoid affecting filled sheet edit/create/clone

- **Filled sheets** use `FilledSheetSubsheetForm` with `strictNumericValidation` (Create/Edit) or without (Clone). Template create/edit use **InfoTemplateBuilder** and **SubsheetBuilder**, which are **separate** components and do not use `FilledSheetSubsheetForm` or `numericFieldHelpers` today.
- Any future use of `numericFieldHelpers` in **InfoTemplateBuilder** (or a new “default value” cell) would be **template-only**; no change to filled sheet components is required.
- Keep **template** Zod schemas (`infoFieldTemplateSchema`, `templateEditMetadataSchema`) and **filled** schemas (`infoFieldSchema`, `unifiedSheetSchemaForClone`, etc.) separate; do not share a single schema that mixes template and filled “value” rules.

### Proposed test cases (for when default value exists)

**UI (template create/edit):**

- Required int/decimal default blank: show “This field is required.” and block submit (if submit includes subsheet field payload).
- Non-numeric default (e.g. “abc”) for int/decimal field: show “Enter a number.” and block submit.
- Valid numeric default (e.g. “10.5”): accepted and included in payload.
- Optional int/decimal default blank: omitted from payload (or sent as null/empty per API contract).

**API (template field create/update):**

- If API is extended to accept `defaultValue` or `value`:
  - Validate that for infoType `int`/`decimal`, value is either missing/blank or a finite number string; return 400 with a clear message otherwise.
  - Tests: POST/PATCH with invalid numeric default → 400; valid numeric default → 201/200 and correct DB/response.

**DB (if DefaultValue column is added):**

- Migration and constraints: type/length appropriate for numeric string (e.g. VARCHAR) or separate numeric column; document whether null means “no default.”

---

## Summary

| Topic | Finding |
|-------|--------|
| **Numeric default inputs** | Template UI has **no** default value input; only infoType (int/decimal/varchar) is set. |
| **Validation** | Template create uses `unifiedTemplateSchema` (infoFieldTemplateSchema); template edit uses metadata-only schema. No numeric default validation today. |
| **DB** | InformationTemplates: no DefaultValue column in use. |
| **Safe rollout** | Introduce numericFieldHelpers only when/where a “default value” (or “value”) input is added for template fields (e.g. in InfoTemplateBuilder), and keep that logic template-only so filled sheet edit/create/clone are unaffected. |

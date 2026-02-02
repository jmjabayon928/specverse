# Phase 3: Clone Flows Discovery Report

## Routes and handlers

### Template clone (template → template)

| Layer | File | Symbol / Path |
|-------|------|----------------|
| Route | `src/backend/routes/templateRoutes.ts` | `POST /:id/clone` (mounted at `/api/backend/templates`) |
| Handler | `src/backend/controllers/templateController.ts` | `cloneTemplateHandler` |
| Service | `src/backend/services/templateService.ts` | `cloneTemplateFrom(sourceTemplateId, overrides, userId)` |

- **Behavior**: Creates a **new template** (IsTemplate=1), not a filled sheet. Source template is loaded via `getTemplateDetailsById`; payload is built with `...src, ...overrides`, `sheetId` cleared, `isTemplate: true`, status set to Draft, workflow fields reset. `createTemplate(payload, userId)` is called; returns `{ sheetId }` (new template ID).
- **UI**: `src/app/(admin)/datasheets/templates/[id]/clone/` — `TemplateClonerForm` submits to template clone API; redirects to `/datasheets/templates/{sheetId}?success=cloned`.

**Note**: "Clone Approved Template → new Filled Sheet" in the task refers to the **Create Filled Sheet** flow (user selects an approved template and creates a new filled sheet), not this template clone. That flow uses `POST /api/backend/filledsheets` (createFilledSheetHandler) and `createFilledSheet` in filledSheetService.

### Filled clone (filled → filled)

| Layer | File | Symbol / Path |
|-------|------|----------------|
| Route | `src/backend/routes/filledSheetRoutes.ts` | `POST /:id/clone` (mounted at `/api/backend/filledsheets`) |
| Handler | `src/backend/controllers/filledSheetController.ts` | `cloneFilledSheetHandler` |
| Service | `src/backend/services/filledSheetService.ts` | Uses `createFilledSheet` (same as Create Filled Sheet) |

- **Behavior**: Resolves source sheet’s `TemplateID` via `getFilledSheetTemplateId(sourceId)`; resolves **latest approved** template in chain via `getLatestApprovedTemplateId(sourceTemplateId)` (new sheet binds to that template, not necessarily the source’s TemplateID). Validates `equipmentTagNum` and `projectId` (required, unique per project). Builds `createInput` from body + `templateId: resolvedTemplateId`, `equipmentTagNum`, `projectId`, `isTemplate: false`, `fieldValues: body.fieldValues ?? {}`. Calls `createFilledSheet(createInput, ctx)`; returns `{ sheetId }` (new filled sheet ID).
- **UI**: `src/app/(admin)/datasheets/filled/[id]/clone/` — `FilledSheetClonerForm` builds body from current sheet + user edits (e.g. equipment tag); POSTs to filled clone API; redirects to `/datasheets/filled/{sheetId}?success=cloned`.

### Create Filled Sheet (template → filled)

| Layer | File | Symbol / Path |
|-------|------|----------------|
| Route | `src/backend/routes/filledSheetRoutes.ts` | `POST /` (createFilledSheetHandler) |
| Service | `src/backend/services/filledSheetService.ts` | `createFilledSheet(data, context)` |

- **Behavior**: Validates template exists, is template, Approved, IsLatest. Inserts one **Sheets** row (IsTemplate=0, TemplateID=templateId), then `cloneSubsheetsAndFields` (subsheets + InformationTemplates + InformationValues from `fieldValues`). Does **not** insert into SheetRevisions. First revision is created on first **update** (see updateFilledSheet + createRevision).

---

## Fields and semantics

### Template clone

- **Copied**: Full template snapshot (sheet + subsheets + fields + options) with overrides applied.
- **Reset**: `sheetId` (undefined), `isTemplate: true`, `status: 'Draft'`, workflow dates/IDs (verified, approved, etc.).
- **DB**: New row in Sheets (IsTemplate=1). Template clone does not create SheetRevisions rows.

### Filled clone

- **Copied**: Header and field values from request body (from UI, derived from source filled sheet). Template structure and values come from the **resolved latest approved template**; values come from `body.fieldValues` (keyed by template field id).
- **Linkage**: New sheet’s `TemplateID` = `getLatestApprovedTemplateId(sourceTemplateId)` (not the source sheet’s TemplateID if that template has been superseded).
- **Not copied**: Revision history. `createFilledSheet` does not read or insert SheetRevisions; the new sheet starts with no revision rows.
- **DB**: New row in Sheets (IsTemplate=0, TemplateID=resolvedTemplateId). Subsheets, InformationTemplates, InformationValues created per template + fieldValues. No SheetRevisions row until first update.

### Create Filled Sheet (template → filled)

- Same as filled clone from a “template + field values” perspective: one new Sheets row (IsTemplate=0, TemplateID=templateId), subsheets/fields/values from template + fieldValues. No SheetRevisions row on create.

---

## Revision semantics

- **createFilledSheet** (used by both Create Filled and Filled Clone): Inserts only into Sheets, SubSheets, InformationTemplates, InformationValues (and value-set/audit as applicable). Does **not** call `createRevision`.
- **createRevision** is called from:
  1. **updateFilledSheet** (filledSheetService) — on successful update of a filled sheet.
  2. **restore** (sheetRevisionController) — when restoring a revision snapshot.
- So: **No SheetRevisions row exists immediately after create or clone.** First edit/save creates SystemRevisionNum=1 (via updateFilledSheet → createRevision).

---

## DB expectations (Sheets + SheetRevisions)

| Flow | New Sheets row | IsTemplate | TemplateID | SheetRevisions after |
|------|----------------|------------|------------|----------------------|
| Template clone | Yes (new template) | 1 | N/A (template) | Not created by clone |
| Create Filled Sheet | Yes | 0 | templateId | None until first update |
| Filled clone | Yes | 0 | resolvedTemplateId (latest approved) | None until first update |

---

## Files to touch for Phase 3

- **Tests**: Add `tests/api/templateClone.test.ts` (template clone endpoint). Extend `tests/api/filledSheetClone.test.ts` (filled clone: createFilledSheet receives isTemplate: false, templateId set; no revision copy).
- **Fixes**: None required if behavior above matches product intent; verification is via tests and manual clone (template + filled) and first edit.

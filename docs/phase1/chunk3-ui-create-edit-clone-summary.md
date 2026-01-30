# Phase 1 Chunk 3 — UI Summary (Template Create + Edit + Clone)

## What changed

### 1. Validation schema
- **`src/validation/sheetSchema.ts`**  
  Added optional `disciplineId` and `subtypeId` to `unifiedSheetSchema` so they are included in validated payloads and sent to the API.

### 2. Template create form
- **`src/app/(admin)/datasheets/templates/create/TemplateCreatorForm.tsx`**  
  - Fetches disciplines and subtypes from `/api/backend/templates/reference-options` (in addition to existing `/api/backend/references`).  
  - New **Discipline** section at top: required **Discipline** dropdown and optional **Subtype (optional)** dropdown.  
  - Subtype options are filtered by selected discipline; subtype dropdown is disabled until a discipline is selected.  
  - On discipline change, subtype selection is cleared.  
  - `buildManualErrors`: if `disciplineId` is missing or not a positive number, adds `disciplineId: ['Discipline is required.']` so submit is blocked.  
  - Initial state includes `disciplineId: undefined`, `subtypeId: undefined`.  
  - Submit payload includes `disciplineId` (required for create) and `subtypeId` (optional).

### 3. Template edit form
- **`src/app/(admin)/datasheets/templates/[id]/edit/TemplateEditorForm.tsx`**  
  - Client-side fetch of disciplines and subtypes from `/api/backend/templates/reference-options`.  
  - Same **Discipline** section: Discipline dropdown (existing value from `defaultValues`), optional Subtype dropdown (options filtered by selected discipline, disabled when no discipline).  
  - On discipline change, subtype is cleared.  
  - Persists via existing PUT; payload includes `disciplineId` and `subtypeId` (optional on update).  
  - Handles null/undefined for older templates (discipline/subtype can be missing).

### 4. Template clone form
- **`src/app/(admin)/datasheets/templates/[id]/clone/TemplateClonerForm.tsx`**  
  - Same client-side fetch of disciplines and subtypes.  
  - **Discipline** section with Discipline and Subtype dropdowns; initial values come from source template (`defaultValues` from `getTemplateDetailsById`).  
  - User can change discipline/subtype before saving.  
  - `buildManualErrors`: discipline required (same as create) so clone cannot be submitted without a discipline.  
  - Submit goes to POST create; payload includes `disciplineId` and `subtypeId`.

### 5. Template detail header (optional)
- **`src/app/(admin)/datasheets/templates/[id]/TemplatePageClient.tsx`**  
  - Read-only line under the description: shows `disciplineName` (or nothing when both discipline and subtype are empty). When subtype is present, shows `disciplineName · subtypeName`. For old templates with no discipline/subtype, the line is not shown.

## What did not change

- Templates list page (Chunk 2)
- Filled sheets pages
- Backend
- Exports, sidebar, routes
- Workflow

## How to verify manually

### Create template
1. Go to **Datasheet Templates** → **+ New Template**.  
2. Leave **Discipline** on “-- Select --” and try **Save Template**. You should see “Discipline is required.” and submit should not succeed.  
3. Select a **Discipline**. **Subtype (optional)** becomes enabled and shows only subtypes for that discipline.  
4. Optionally select a **Subtype**.  
5. Fill other required fields and at least one subsheet, then **Save Template**. Template should be created and show the chosen discipline (and subtype) on the detail page and in the list.

### Edit template
1. Open an existing template (with or without discipline set).  
2. Go to **Edit**.  
3. **Discipline** and **Subtype** should show current values (or “-- Select --” if null).  
4. Change **Discipline**; **Subtype** selection should clear and options should update to the new discipline.  
5. Change **Subtype** if desired, then save. Template should update and show the new discipline/subtype.

### Clone template
1. Open a template that has a discipline (and optionally subtype) set.  
2. Use **Clone** (e.g. from actions).  
3. **Discipline** and **Subtype** should be pre-filled from the source template.  
4. Change them if desired; fill required fields (e.g. Equipment Tag #), then save. New template should be created with the chosen discipline/subtype.

### Template detail
1. Open a template that has discipline (and optionally subtype) set.  
2. Under the description you should see a line like “Piping” or “Piping · Pressure Transmitter”.  
3. For a template with no discipline/subtype, that line should not appear.

## Stop conditions

- Create template works end-to-end and persists discipline/subtype.  
- Edit template updates discipline/subtype.  
- Clone template preserves discipline/subtype by default and allows changing them.  
- No other pages changed.  
- Typecheck passes (`npx tsc --noEmit`).

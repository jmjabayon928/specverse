# Phase 1 Chunk 2 — UI Summary (Template List Filter + Badge)

## What changed

**File:** `src/app/(admin)/datasheets/templates/page.tsx`

1. **Template row type**  
   Extended `TemplateRow` with optional `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName` (from Chunk 1 API).

2. **Reference options**  
   Added types and handling for `disciplines` and `subtypes` from `/api/backend/templates/reference-options`.  
   Populate `disciplineOptions` and `subtypesRaw`; map disciplines to dropdown options; derive subtype options (all subtypes when no discipline selected, or filtered by selected discipline).

3. **Discipline badge**  
   New **Discipline** column: each row shows a small badge with `disciplineName`, or **"Unspecified"** when `disciplineName` is null/empty.

4. **Discipline filter**  
   New **Filter by Discipline** dropdown in the filter bar. Client-side filter: only rows with matching `disciplineId` are shown. When no value is selected, all templates are shown.

5. **Subtype filter**  
   New **Filter by Subtype** dropdown. Options are all subtypes when no discipline is selected, or only subtypes for the selected discipline. Changing discipline clears the subtype selection. Client-side filter by `subtypeId`.

6. **Filter bar layout**  
   Filter bar grid updated to accommodate the two new dropdowns (e.g. 6 columns on large screens).

7. **Empty state**  
   Table empty-state colspan updated from 7 to 8 for the new column.

## What did not change

- Template create/edit/clone forms
- Filled sheets pages
- Backend
- Exports, sidebar, routes

## How to verify manually

1. Open **Datasheet Templates** (e.g. `/datasheets/templates`).
2. **Badge:** Each row has a **Discipline** column with a gray badge showing the discipline name or **"Unspecified"**.
3. **No filter:** With **Filter by Discipline** and **Filter by Subtype** both cleared, the list shows all templates.
4. **Discipline filter:** Choose a discipline in **Filter by Discipline**. List shows only templates for that discipline. Clear the filter; list shows all again.
5. **Subtype filter:** Choose a discipline, then choose a subtype in **Filter by Subtype**. List shows only templates for that subtype. Change discipline; subtype dropdown options update to that discipline’s subtypes, and subtype selection is cleared.

## Stop conditions

- Template list page compiles and renders.
- Filtering works as above.
- No other datasheet pages were changed.

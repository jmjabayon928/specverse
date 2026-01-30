# Phase 1 Chunk 1 — Change Summary (Backend + Types Only)

## What changed

### A) Domain types
- **`src/domain/datasheets/sheetTypes.ts`**  
  Added to `UnifiedSheet`: `disciplineId?`, `disciplineName?`, `subtypeId?`, `subtypeName?` (all optional, `number | null` or `string | null`).

### B) Reference options
- **`src/backend/services/templateService.ts`**  
  `fetchTemplateReferenceOptions()` now also queries `dbo.Disciplines` and `dbo.DatasheetSubtypes` and returns `disciplines` and `subtypes` in the cached payload.  
  Response shape: `disciplines: Array<{ id, code, name }>`, `subtypes: Array<{ id, disciplineId, code, name }>` (code/name from DisciplineName and SubtypeName).

### C) Template list + detail
- **`src/backend/services/templateService.ts`**  
  - `fetchAllTemplates()`: LEFT JOIN `Disciplines` and `DatasheetSubtypes`, SELECT `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName` per row.  
  - `getTemplateDetailsById()`: same JOINs, same four fields in SELECT and mapped onto `datasheet`.

### D) Template create/update
- **`src/backend/services/templateService.ts`**  
  - `applySheetInputsForInsert` / INSERT: added `DisciplineID`, `DatasheetSubtypeID` (from `data.disciplineId` / `data.subtypeId`).  
  - `applySheetInputsForUpdate` / UPDATE: same two columns in SET.  
- **`src/backend/controllers/templateController.ts`**  
  - Create body: `disciplineId` required (Zod `z.number().int().positive()`), `subtypeId` optional.  
  - Update body: `disciplineId` and `subtypeId` optional.

### E) Filled list/detail/create
- **`src/backend/services/filledSheetService.ts`**  
  - `fetchAllFilled()`: LEFT JOIN Disciplines and DatasheetSubtypes, return `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName` on each row.  
  - `getFilledSheetDetailsById()`: same JOINs; `RawSheetRow` and `buildUnifiedSheetFromRow()` extended with the four fields.  
  - `createFilledSheet()`: before `insertSheet`, loads template row (`SELECT DisciplineID, DatasheetSubtypeID FROM Sheets WHERE SheetID = @TemplateID`) and overrides `data.disciplineId` / `data.subtypeId` from template (server-side copy).  
  - `insertSheet()`: INSERT includes `DisciplineID`, `DatasheetSubtypeID`.

### F) duplicateSheet
- **`src/backend/database/duplicateSheet.ts`**  
  INSERT now includes `DisciplineID` and `DatasheetSubtypeID` copied from the source sheet row.

### G) Tests
- **`tests/api/datasheets.templates.test.ts`**  
  - Reference-options: assert `disciplines` and `subtypes` are arrays.  
  - List: assert each item can have `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName`.  
  - Create payload: `buildTemplatePayload()` includes `disciplineId` (from first discipline or FALLBACK_REF_ID).  
  - Create without `disciplineId`: new test expects 400.  
  - GET by id: assert `datasheet` can have `disciplineId`.  
- **`tests/api/datasheets.filled.test.ts`**  
  - List: assert each item can have the four discipline/subtype fields.

### H) Docs / SQL (not run)
- **`docs/phase1/verify-discipline-schema.sql`**  
  Verification queries: Disciplines and DatasheetSubtypes tables exist; Sheets has `DisciplineID` and `DatasheetSubtypeID`.  
- **`docs/phase1/backfill-sheets-discipline.sql`**  
  Commented SQL to backfill `Sheets.DisciplineID` where NULL (manual step; do not run automatically).  
- **`docs/phase1/chunk1-change-summary.md`**  
  This file.

---

## What did not change

- No UI files (`src/app`, `src/components`).
- No export code (PDF/Excel).
- No workflow/lifecycle logic.
- No new routes or pages.
- No schema migrations executed (only verification SQL provided).
- No Phase 2+ tables (ValueSets, etc.).

---

## Assumptions

1. **Schema:** `dbo.Disciplines` (e.g. DisciplineID, DisciplineName; optional DisciplineCode), `dbo.DatasheetSubtypes` (DatasheetSubtypeID, DisciplineID, SubtypeName; optional SubtypeCode), and `Sheets` with nullable `DisciplineID` and `DatasheetSubtypeID`. If any are missing, run `docs/phase1/verify-discipline-schema.sql` and add the missing objects before using Chunk 1.
2. **Backward compatibility:** Existing rows with NULL discipline/subtype remain valid; list/detail return nulls. Create template now requires `disciplineId` (400 if missing).
3. **Filled create:** Discipline/subtype are taken from the template server-side (templateId → SELECT DisciplineID, DatasheetSubtypeID → override payload), so the created filled sheet gets the template’s discipline/subtype even if the client omits them.

---

## How to test locally

1. **Verify schema (mandatory first):**  
   Run the statements in `docs/phase1/verify-discipline-schema.sql` against your DB. If any check fails, add the missing table/columns (no migrations are run by this chunk).

2. **Typecheck:**  
   `npx tsc --noEmit`

3. **Tests (PowerShell):**  
   ```powershell
   cd c:\Users\jmjab\Desktop\nextjs\specverse
   npx jest tests/api/datasheets.templates.test.ts tests/api/datasheets.filled.test.ts --passWithNoTests
   ```  
   Or run the full suite:  
   ```powershell
   npm run test
   ```
   Tests that call the DB will fail if Disciplines/DatasheetSubtypes are missing or empty (e.g. create template needs at least one discipline).

4. **Manual API checks (optional):**  
   - `GET /api/backend/templates/reference-options`: response includes `disciplines` and `subtypes`.  
   - `GET /api/backend/templates`: each row can have `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName`.  
   - `GET /api/backend/templates/:id`: `datasheet` has the same four fields.  
   - `POST /api/backend/templates` without `disciplineId`: 400.  
   - `POST /api/backend/templates` with valid `disciplineId`: 201 and persisted discipline/subtype.  
   - `GET /api/backend/filledsheets`: each row can have the four fields.  
   - Create a filled sheet from a template with discipline set; GET that filled sheet and confirm `disciplineId`/`subtypeId` match the template.

---

## Backfill (manual, do not run in app)

After deployment, to set a default discipline for existing Sheets with NULL `DisciplineID`, use the commented SQL in `docs/phase1/backfill-sheets-discipline.sql` (e.g. set DisciplineID to your Piping discipline ID). Run it manually when appropriate.

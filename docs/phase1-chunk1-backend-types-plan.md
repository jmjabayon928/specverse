# Phase 1 – Chunk 1: Backend + Types Only (No UI)

**Scope:** Add discipline/subtype to backend DTOs and APIs so the frontend can display/filter later. No UI, no new routes/pages, no exports changes.

**Rules:** Preserve behavior when discipline fields are NULL; no breaking API contracts; minimal, cherry-pick safe; strict types, no `any`.

---

## 0. Confirmation: Current Backend Flow

| Concern | Route/Handler | Service | Returns / Accepts |
|--------|----------------|---------|-------------------|
| **Template list** | `GET /api/backend/templates` | `getAllTemplatesHandler` | `fetchAllTemplates()` → array of rows: `sheetId`, `sheetName`, `sheetDesc`, `categoryId`, `categoryName`, `preparedById`, `preparedByName`, `revisionDate`, `status` |
| **Template reference options** | `GET /api/backend/templates/reference-options` | `getTemplateReferenceOptionsHandler` | `fetchTemplateReferenceOptions()` → `{ categories, users }` |
| **Template detail** | `GET /api/backend/templates/:id` | `getTemplateById` | `getTemplateDetailsById(templateId, lang)` → `{ datasheet: UnifiedSheet, translations }` |
| **Template create** | `POST /api/backend/templates` | `createTemplateHandler` | Body: `UnifiedSheet` (passthrough). `createTemplate(payload, userId)` → INSERT into Sheets (no DisciplineID/SubtypeID today). |
| **Template update** | `PUT /api/backend/templates/:id` | `updateTemplateHandler` | Body: `UnifiedSheet`. `updateTemplate(sheetId, payload, userId)` → UPDATE Sheets (no DisciplineID/SubtypeID today). |
| **Filled sheet creation (template → filled)** | `POST /api/backend/filledsheets` | `createFilledSheetHandler` | Body: `CreateFilledSheetBody` (UnifiedSheet + `fieldValues`). `createFilledSheet(createInput, ctx)` → `insertSheet(tx, data, userId, templateIdNum)` in `filledSheetService`; INSERT into Sheets (no DisciplineID/SubtypeID). Data comes from client (template pre-loaded with getTemplateDetailsById); we must copy discipline from template into new sheet row. |
| **Filled list** | `GET /api/backend/filledsheets` | `getAllFilled` | `fetchAllFilled()` → array of rows: same shape as template list (no discipline today). |
| **Filled detail** | `GET /api/backend/filledsheets/:id` | `getFilledSheetById` | `getFilledSheetDetailsById(sheetId, lang, uom)` → `{ datasheet: UnifiedSheet, ... }`; datasheet built via `buildUnifiedSheetFromRow(row)` from `Sheets` row (`s.*`). |

**Template clone:** `cloneTemplateFrom(sourceTemplateId, overrides, userId)` uses `getTemplateDetailsById` then `createTemplate(payload)`; once detail returns discipline and create persists it, clone will carry discipline. No separate change needed for clone.

**duplicateSheet.ts:** Used by `datasheetHelpers.duplicateSheet` (different path). For Chunk 1 we can either (a) add DisciplineID/SubtypeID to its INSERT when cloning so cloned sheets keep discipline, or (b) leave duplicateSheet for a later chunk. Plan includes (a) for consistency.

---

## 1. Schema Verification (Do First; Stop If Missing)

**Before any code changes:**

1. Confirm table **Disciplines** exists with at least: `DisciplineID` (PK), `DisciplineName` (or `Name`/`Code`).
2. Confirm table **DatasheetSubtypes** exists with at least: `DatasheetSubtypeID` (PK), `DisciplineID` (FK), `SubtypeName` (or `Name`/`Code`).
3. Confirm **Sheets** has nullable columns: `DisciplineID` (FK to Disciplines), `DatasheetSubtypeID` (FK to DatasheetSubtypes, nullable).

If any of these are missing: **stop and report**; do not add migrations in this chunk (per user: "No schema migrations unless a column is missing (if missing, stop and report)").

**How to verify:** Run a small script or ad-hoc query, e.g.:

```sql
SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Disciplines';
SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'DatasheetSubtypes';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Sheets' AND COLUMN_NAME IN ('DisciplineID','DatasheetSubtypeID');
```

---

## 2. Step-by-Step Execution Order

1. **Verify schema** (Section 1). If missing, stop and report.
2. **Domain types** – Add optional `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName` to `UnifiedSheet` and add list row DTO type if desired.
3. **Discipline/subtype reference data** – New service functions + expose on existing reference-options (or dedicated endpoint); no new route required if we extend reference-options.
4. **Template list API** – Include discipline/subtype in `fetchAllTemplates` (JOIN + SELECT).
5. **Template detail API** – Include discipline/subtype in `getTemplateDetailsById` (SELECT + map to `datasheet`).
6. **Template create API** – Accept `disciplineId` (required for new templates), `subtypeId` (optional); persist in `createTemplate` INSERT.
7. **Template update API** – Accept and persist `disciplineId`/`subtypeId` in `updateTemplate` UPDATE.
8. **Filled sheet creation** – Ensure `insertSheet` in filledSheetService includes DisciplineID/SubtypeID from `data` (template-derived); copy from template when creating filled sheet.
9. **Filled list API** – Include discipline/subtype in `fetchAllFilled` (JOIN + SELECT).
10. **Filled detail API** – Include discipline/subtype in `getFilledSheetDetailsById` and `buildUnifiedSheetFromRow`.
11. **Template clone (duplicateSheet)** – If duplicateSheet is used for template clone, add DisciplineID/SubtypeID to its INSERT.
12. **Controller validation** – Require `disciplineId` on create (e.g. Zod); allow null for backward compatibility on list/detail.
13. **Tests** – Add/update tests for reference options, list shape, detail shape, create/update payload, filled create copy.
14. **Backfill script** – Provide SQL only; do not run in this chunk.

---

## 3. Exact File List and Changes

### 3.1 Domain types

| File | What will change |
|------|-------------------|
| [`src/domain/datasheets/sheetTypes.ts`](src/domain/datasheets/sheetTypes.ts) | Add to `UnifiedSheet`: `disciplineId?: number \| null`, `disciplineName?: string \| null`, `subtypeId?: number \| null`, `subtypeName?: string \| null`. Keep optional so existing callers and NULL DB values remain valid. |

No new file. Optional: add a shared type for list row (e.g. `TemplateListRow`, `FilledSheetListRow`) with the same discipline fields so list responses are typed consistently.

---

### 3.2 Reference data: disciplines and subtypes

**Option A – Extend existing reference-options (recommended):**  
Add disciplines and subtypes to `fetchTemplateReferenceOptions` and optionally to filled reference-options so one call gives categories, users, disciplines, subtypes.

| File | What will change |
|------|-------------------|
| [`src/backend/services/templateService.ts`](src/backend/services/templateService.ts) | In `fetchTemplateReferenceOptions`: query Disciplines (e.g. `SELECT DisciplineID, DisciplineName FROM Disciplines ORDER BY DisciplineName`); query DatasheetSubtypes (e.g. `SELECT DatasheetSubtypeID, DisciplineID, SubtypeName FROM DatasheetSubtypes ORDER BY DisciplineID, SubtypeName`). Return `{ categories, users, disciplines, subtypes }`. Use same cache key/ttl as today (or include disciplines/subtypes in cached payload). |
| [`src/backend/controllers/templateController.ts`](src/backend/controllers/templateController.ts) | No change to handler; response shape gains `disciplines` and `subtypes`. Backward compatible. |

**Optional:** Add a small helper or query module for discipline/subtype queries (e.g. `getDisciplines()`, `getDatasheetSubtypes(disciplineId?: number)`) and call from `fetchTemplateReferenceOptions`. If filtering subtypes by discipline is needed later, `getDatasheetSubtypes(disciplineId)` is ready.

**Filled reference-options:** If the frontend will use the same dropdowns for filled flows, add disciplines/subtypes to `fetchReferenceOptions` in filledSheetService (and controller) the same way. Otherwise defer to Chunk 2.

---

### 3.3 Template list API

| File | What will change |
|------|-------------------|
| [`src/backend/services/templateService.ts`](src/backend/services/templateService.ts) | In `fetchAllTemplates`: extend SQL to `LEFT JOIN Disciplines d ON s.DisciplineID = d.DisciplineID` and `LEFT JOIN DatasheetSubtypes ds ON s.DatasheetSubtypeID = ds.DatasheetSubtypeID`. Add to SELECT: `s.DisciplineID AS disciplineId`, `d.DisciplineName AS disciplineName`, `s.DatasheetSubtypeID AS subtypeId`, `ds.SubtypeName AS subtypeName` (adjust names to match your DB). Return these on each row. NULLs allowed. |

---

### 3.4 Template detail API

| File | What will change |
|------|-------------------|
| [`src/backend/services/templateService.ts`](src/backend/services/templateService.ts) | In `getTemplateDetailsById`: add to the main Sheets SELECT: `s.DisciplineID`, `d.DisciplineName AS disciplineName`, `s.DatasheetSubtypeID`, `ds.SubtypeName AS subtypeName`, and JOIN `Disciplines d`, `DatasheetSubtypes ds` (LEFT JOIN on s.DisciplineID, s.DatasheetSubtypeID). In the object built for `datasheet`, set `disciplineId: row.DisciplineID ?? null`, `disciplineName: row.disciplineName ?? null`, `subtypeId: row.DatasheetSubtypeID ?? null`, `subtypeName: row.subtypeName ?? null`. |

---

### 3.5 Template create API

| File | What will change |
|------|-------------------|
| [`src/backend/services/templateService.ts`](src/backend/services/templateService.ts) | In `applySheetInputsForInsert`: add `.input('DisciplineID', sql.Int, iv(data.disciplineId))` and `.input('DatasheetSubtypeID', sql.Int, iv(data.subtypeId))` (or nullable Int). In the INSERT statement for Sheets, add `DisciplineID, DatasheetSubtypeID` to the column list and `@DisciplineID, @DatasheetSubtypeID` to the VALUES list. |
| [`src/backend/controllers/templateController.ts`](src/backend/controllers/templateController.ts) | In `createTemplateBodySchema`: add `disciplineId: z.number().int().positive()` (required for create). Add `subtypeId: z.number().int().positive().nullable().optional()`. Keep `.passthrough()` so rest of UnifiedSheet is still accepted. Validate so that if `subtypeId` is provided, it can be validated against the chosen discipline (optional, can be Chunk 2). |

**Backward compatibility:** Existing clients that do not send `disciplineId` will get 400 after this change (required field). That is an intentional contract change for create; list/detail remain backward compatible with NULL.

---

### 3.6 Template update API

| File | What will change |
|------|-------------------|
| [`src/backend/services/templateService.ts`](src/backend/services/templateService.ts) | In `applySheetInputsForUpdate`: add `.input('DisciplineID', sql.Int, iv(data.disciplineId))` and `.input('DatasheetSubtypeID', sql.Int, iv(data.subtypeId))`. In the UPDATE statement, add `DisciplineID = @DisciplineID, DatasheetSubtypeID = @DatasheetSubtypeID`. Allow null (e.g. `iv()` returns null) so existing rows can stay NULL. |
| [`src/backend/controllers/templateController.ts`](src/backend/controllers/templateController.ts) | In `updateTemplateBodySchema`: add `disciplineId: z.number().int().positive().nullable().optional()` and `subtypeId: z.number().int().positive().nullable().optional()` so updates can set or clear them. |

---

### 3.7 Filled sheet creation (template → filled copy)

| File | What will change |
|------|-------------------|
| [`src/backend/services/filledSheetService.ts`](src/backend/services/filledSheetService.ts) | In `insertSheet`: add `.input('DisciplineID', sql.Int, iv(data.disciplineId))` and `.input('DatasheetSubtypeID', sql.Int, iv(data.subtypeId))`. Add `DisciplineID, DatasheetSubtypeID` to the INSERT column list and values. The `data` here is the client payload (UnifiedSheet); when creating a filled sheet from a template, the client is expected to send the template-loaded sheet including `disciplineId`/`subtypeId`. No server-side "load template and merge" in this chunk; we only persist what is in `data`. So: ensure createFilledSheet does not strip discipline fields and insertSheet writes them. |
| [`src/backend/controllers/filledSheetController.ts`](src/backend/controllers/filledSheetController.ts) | No change to schema; `CreateFilledSheetBody` extends UnifiedSheet, so once UnifiedSheet has discipline fields, body may include them. Optional: document that client should pass template’s disciplineId/subtypeId when creating from template. |

---

### 3.8 Filled list API

| File | What will change |
|------|-------------------|
| [`src/backend/services/filledSheetService.ts`](src/backend/services/filledSheetService.ts) | In `fetchAllFilled`: add `LEFT JOIN Disciplines d ON s.DisciplineID = d.DisciplineID` and `LEFT JOIN DatasheetSubtypes ds ON s.DatasheetSubtypeID = ds.DatasheetSubtypeID`. Add to SELECT: `s.DisciplineID AS disciplineId`, `d.DisciplineName AS disciplineName`, `s.DatasheetSubtypeID AS subtypeId`, `ds.SubtypeName AS subtypeName`. Return on each row. |

---

### 3.9 Filled detail API

| File | What will change |
|------|-------------------|
| [`src/backend/services/filledSheetService.ts`](src/backend/services/filledSheetService.ts) | In `getFilledSheetDetailsById`: the main query uses `s.*` and JOINs; add JOINs to Disciplines and DatasheetSubtypes and ensure the row has `DisciplineID`, `DisciplineName` (or alias), `DatasheetSubtypeID`, `SubtypeName` (or alias). Extend `RawSheetRow` with `DisciplineID: number \| null`, `disciplineName: string \| null`, `DatasheetSubtypeID: number \| null`, `subtypeName: string \| null`. In `buildUnifiedSheetFromRow`, set `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName` on the returned UnifiedSheet. |

---

### 3.10 Template clone (duplicateSheet)

| File | What will change |
|------|-------------------|
| [`src/backend/database/duplicateSheet.ts`](src/backend/database/duplicateSheet.ts) | Template row is from `SELECT * FROM Sheets`; if Sheets has DisciplineID/DatasheetSubtypeID, add `.input('DisciplineID', sql.Int, template.DisciplineID ?? null)` and `.input('DatasheetSubtypeID', sql.Int, template.DatasheetSubtypeID ?? null)` and add both to INSERT column list and VALUES. If column names differ (e.g. NVarChar), use the same types as elsewhere. |

---

## 4. New/Updated Tests

| Test file | What to add/change |
|-----------|--------------------|
| [`tests/api/datasheets.templates.test.ts`](tests/api/datasheets.templates.test.ts) | (1) **Reference options:** Assert response includes `disciplines` (array) and `subtypes` (array); optionally assert shape `{ id, name }` or `{ DisciplineID, DisciplineName }` etc. (2) **List:** Assert each item can have optional `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName` (or that keys exist when present). (3) **Create:** In `buildTemplatePayload` and the POST happy path, include `disciplineId: <valid id from reference-options>`. Assert create succeeds and GET by id returns same disciplineId/subtypeId. (4) **Create validation:** POST without `disciplineId` (or invalid) and expect 400. (5) **Update:** PUT with `disciplineId`/`subtypeId` and assert GET returns updated values. (6) **Detail:** GET template by id and assert `datasheet.disciplineId`, `datasheet.disciplineName`, etc. (nullable). |
| [`tests/api/datasheets.filled.test.ts`](tests/api/datasheets.filled.test.ts) | (1) **List:** Assert response array items can include optional `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName`. (2) **Create from template:** If you have a test that creates a filled sheet from a template, send `disciplineId`/`subtypeId` from the template in the body and assert the created filled sheet (GET by id or list) has the same discipline/subtype. |
| **New (optional)** | Unit tests for discipline/subtype query helpers (if extracted), or integration test that calls reference-options and asserts disciplines/subtypes structure. |

Use strict types in tests (e.g. type the response body) and type guards where needed; avoid `any`.

---

## 5. Backfill Script (SQL Only; Do Not Run in Chunk 1)

Purpose: set a default discipline for existing Sheets where `DisciplineID IS NULL` so that list/detail and future UI show a consistent value (e.g. “Piping”).

```sql
-- Backfill Sheets with default discipline (e.g. Piping).
-- Run only after Chunk 1 is deployed and Disciplines has the default row.
-- Replace 1 with the actual DisciplineID for "Piping" (or your default).

UPDATE Sheets
SET DisciplineID = 1
WHERE DisciplineID IS NULL;
```

If “Piping” does not exist in Disciplines, insert it first:

```sql
-- Example: ensure default discipline exists (adjust name/code to match your schema).
INSERT INTO Disciplines (DisciplineName, DisciplineCode)
SELECT N'Piping', N'Piping'
WHERE NOT EXISTS (SELECT 1 FROM Disciplines WHERE DisciplineCode = N'Piping');
```

Provide this script in the repo (e.g. `migrations/backfill_sheets_discipline.sql` or in docs); do not execute it as part of Chunk 1.

---

## 6. Minimal Code Diffs Summary

- **sheetTypes.ts:** Add 4 optional properties to `UnifiedSheet`.
- **templateService.ts:** Reference options: +disciplines, +subtypes queries and return. List: +JOINs and +4 columns. Detail: +JOINs, +4 fields in SELECT, +4 in datasheet object. Insert: +2 inputs and +2 columns in INSERT. Update: +2 inputs and +2 in UPDATE SET.
- **templateController.ts:** createTemplateBodySchema: +disciplineId required, +subtypeId optional. updateTemplateBodySchema: +disciplineId, +subtypeId optional.
- **filledSheetService.ts:** insertSheet: +2 inputs, +2 columns in INSERT. fetchAllFilled: +JOINs, +4 columns. getFilledSheetDetailsById: +JOINs; RawSheetRow +4; buildUnifiedSheetFromRow +4.
- **duplicateSheet.ts:** +2 inputs and +2 columns in INSERT from template row.

---

## 7. Out of Scope (Explicit)

- No UI updates.
- No new routes or pages.
- No exports (PDF/Excel) changes.
- No vendor / offered vs as-built logic.
- No schema migrations in this chunk (only verify; if missing, stop and report).

---

*End of Chunk 1 plan.*

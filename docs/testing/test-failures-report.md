# Test Failures Report

Generated from: `npm test -- --runInBand --no-cache` and `npm test -- --runInBand --no-cache --verbose`.

---

## Environment

| Item | Value |
|------|--------|
| Node | v20.20.0 |
| npm | 10.8.2 |
| Jest | 29.7.0 |
| Jest projects | 2: **backend**, **frontend** |

---

## Summary

| Metric | Count |
|--------|--------|
| **Failing test suites** | 5 |
| Passing test suites | 31 |
| Total test suites | 36 |
| Failing tests | 9 |
| Passing tests | 150 |
| Total tests | 159 |

**Note:** Three of the five failing suites hit the real database. The backend returns **500** when queries reference columns that do not exist in the current DB schema (`DisciplineName`, `SubtypeName`, `DatasheetSubtypeID`, etc.). Those suites effectively **require** either (1) the Phase 1 discipline/subtype schema (Disciplines and DatasheetSubtypes tables, plus Sheets columns), or (2) mocking the DB so those queries are not executed.

---

## Failing suite 1: `tests/api/datasheets.templates.test.ts`

- **Jest project:** backend
- **Failing test names:**
  1. `Templates API › GET /api/backend/templates should return 200 and array with optional discipline fields`
  2. `Templates API › GET /api/backend/templates/reference-options should return 200 and include disciplines and subtypes`
  3. `Templates API › POST → GET → PUT → VERIFY template (happy path)`
  4. `Templates API › POST /api/backend/templates should return 400 when disciplineId is missing`

**Primary error message:**

```
expect(received).toBe(expected) // Object.is equality
Expected: 200
Received: 500
```

(First failure at line 205: `expect(res.statusCode).toBe(200)`.)

**Root cause (from server logs):** The app returns 500 because the database query fails:

- `RequestError: Invalid column name 'SubtypeName'.`
- `RequestError: Invalid column name 'DatasheetSubtypeID'.`
- `RequestError: Invalid column name 'DisciplineName'.`

**Stack trace snippet (test):**

```
at Object.<anonymous> (tests/api/datasheets.templates.test.ts:205:28)
```

**Stack trace snippet (server-side error):**

```
Failed to fetch templates RequestError: Invalid column name 'SubtypeName'.
  at handleError (node_modules/mssql/lib/tedious/request.js:384:15)
  ...
  at getAllTemplatesHandler (src/backend/controllers/templateController.ts:252:5)
```

**Suspected root cause:** **Schema mismatch / DB dependency.** Backend queries reference `dbo.Disciplines` and `dbo.DatasheetSubtypes` (and discipline/subtype columns on Sheets). If those tables/columns are missing, the suite fails with 500. Run `docs/phase1/verify-discipline-schema.sql` and apply Phase 1 migrations/seeds, or mock the DB for these tests.

---

## Failing suite 2: `tests/services/filledSheetService.test.ts`

- **Jest project:** backend
- **Failing test names:**
  1. `Filled Sheets API › GET /api/backend/filledsheets should return 200 and an array`

**Primary error message:**

```
expect(received).toBe(expected) // Object.is equality
Expected: 200
Received: 500
```

(at line 58: `expect(res.statusCode).toBe(200)`.)

**Stack trace snippet (test):**

```
at Object.<anonymous> (tests/services/filledSheetService.test.ts:58:28)
```

**Suspected root cause:** **DB dependency / schema mismatch.** Same as suite 1: the filled-sheets list endpoint queries Sheets with JOINs to Disciplines and DatasheetSubtypes. Missing tables/columns produce 500.

---

## Failing suite 3: `tests/api/datasheets.filled.test.ts`

- **Jest project:** backend
- **Failing test names:**
  1. `Filled Sheets API › GET /api/backend/filledsheets should return 200 and array with optional discipline fields`

**Primary error message:**

```
expect(received).toBe(expected) // Object.is equality
Expected: 200
Received: 500
```

(at line 40: `expect(res.statusCode).toBe(200)`.)

**Stack trace snippet (test):**

```
at Object.<anonymous> (tests/api/datasheets.filled.test.ts:40:28)
```

**Suspected root cause:** **DB dependency / schema mismatch.** Same as suites 1 and 2; GET `/api/backend/filledsheets` fails with 500 when discipline/subtype columns or tables are missing.

---

## Failing suite 4: `tests/ui/datasheets/TemplateEditorForm.test.tsx`

- **Jest project:** frontend
- **Failing test names:**
  1. `TemplateEditorForm › submits a PUT request with fieldValues and updated sheetName on success`

**Primary error message:**

```
expect(received).toBe(expected) // Object.is equality
Expected: "/api/backend/templates/1"
Received: "/api/backend/templates/reference-options"
```

(at line 108: `expect(url).toBe(\`/api/backend/templates/${sheet.sheetId}\`)`.)

**Stack trace snippet (test):**

```
at Object.<anonymous> (tests/ui/datasheets/TemplateEditorForm.test.tsx:108:17)
```

**Suspected root cause:** **Fetch mock / call order.** The test assumes the first `fetch` call is the PUT to the template URL. The component now calls `fetch('/api/backend/templates/reference-options')` (e.g. for discipline/subtype options) before or in addition to the PUT. The test asserts on the first call, which is reference-options instead of the PUT. Adjust the test to assert on the PUT call (e.g. by call index or by filtering mock calls by URL/method).

---

## Failing suite 5: `tests/ui/datasheets/TemplateClonerForm.test.tsx`

- **Jest project:** frontend
- **Failing test names:**
  1. `TemplateClonerForm › requires at least one subsheet and shows error if none`
  2. `TemplateClonerForm › POSTs to /api/backend/templates on success`

**Primary error messages:**

1. **First test:**  
   `expect(jest.fn()).not.toHaveBeenCalled()`  
   Expected number of calls: 0, Received number of calls: 1  
   Call: `"/api/backend/templates/reference-options", {"credentials": "include"}`  
   (at line 58: `expect(globalThis.fetch).not.toHaveBeenCalled()`.)

2. **Second test:**  
   `expect(received).toBeDefined()`  
   Received: undefined  
   (at line 96: `expect(postCall).toBeDefined()`.)

**Stack trace snippets (tests):**

```
at Object.<anonymous> (tests/ui/datasheets/TemplateClonerForm.test.tsx:58:34)
at Object.<anonymous> (tests/ui/datasheets/TemplateClonerForm.test.tsx:96:22)
```

**Suspected root cause:** **Fetch mock / call order.**  
- The “requires at least one subsheet” test expects no `fetch`; the component now fetches reference-options (e.g. on mount or when showing the form), so `fetch` is called. Update the test to allow the reference-options call or reset mocks after mount.  
- The “POSTs to … on success” test looks for a call to `POST /api/backend/templates`; the way the test finds the POST call may be wrong when there are multiple calls (e.g. reference-options then POST). Fix by selecting the call by method and URL (e.g. find the call where URL is `/api/backend/templates` and method is POST).

---

## Notes

- **Backend suites (1–3):** Require a DB with Phase 1 discipline/subtype schema, or mocked `poolPromise`/queries so that template and filled-sheet list/reference-options endpoints do not run the real discipline/subtype SQL.
- **Frontend suites (4–5):** No DB required. Failures are from fetch mock expectations (first call vs PUT, and “no fetch” vs reference-options fetch). Updating the tests to match current component behavior (reference-options + PUT) should fix them.
- **Env:** `JWT_SECRET` is set in `tests/setup-env.ts`; backend tests use real app and DB when `DB_*` env vars are set.

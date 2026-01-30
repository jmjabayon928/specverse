# Fix 500s: Discipline/Subtype Column Errors — Summary

**Confirmed DB schema (Phase 1):**
- `Sheets.DisciplineID` (nullable), `Sheets.SubtypeID` (nullable)
- `Disciplines(DisciplineID, Name)`
- `DatasheetSubtypes(SubtypeID, DisciplineID, Name)`

No references to `DisciplineName`, `SubtypeName`, or `DatasheetSubtypeID` columns.

---

## 1. Discovery (no code changes)

### 1a. Handlers and SQL locations

| Endpoint | Handler | Service function | File:line |
|----------|---------|------------------|-----------|
| GET /api/backend/templates | getAllTemplatesHandler | fetchAllTemplates | templateController.ts ~247; templateService.ts ~491 |
| GET /api/backend/templates/reference-options | getTemplateReferenceOptionsHandler | fetchTemplateReferenceOptions | templateController.ts ~256; templateService.ts ~441 |
| GET /api/backend/filledsheets | getAllFilled | fetchAllFilled | filledSheetController.ts ~220; filledSheetService.ts ~93 |

### 1b. Exact SQL / query builder (before fix)

**fetchAllTemplates (templateService.ts):**
```sql
SELECT 
  s.SheetID AS sheetId,
  s.SheetName AS sheetName,
  s.SheetDesc AS sheetDesc,
  s.CategoryID AS categoryId,
  c.CategoryName AS categoryName,
  s.PreparedByID AS preparedById,
  u.FirstName + ' ' + u.LastName AS preparedByName,
  s.RevisionDate AS revisionDate,
  s.Status AS status,
  s.DisciplineID AS disciplineId,
  d.DisciplineName AS disciplineName,
  s.DatasheetSubtypeID AS subtypeId,
  ds.SubtypeName AS subtypeName
FROM Sheets s
LEFT JOIN Categories c ON s.CategoryID = c.CategoryID
LEFT JOIN Users u ON s.PreparedByID = u.UserID
LEFT JOIN dbo.Disciplines d ON s.DisciplineID = d.DisciplineID
LEFT JOIN dbo.DatasheetSubtypes ds ON s.DatasheetSubtypeID = ds.DatasheetSubtypeID
WHERE s.IsTemplate = 1
ORDER BY s.SheetID DESC
```

**fetchTemplateReferenceOptions (templateService.ts):** Four separate queries:
- Categories: `SELECT CategoryID, CategoryName FROM Categories ORDER BY CategoryName`
- Users: `SELECT UserID, FirstName, LastName FROM Users ORDER BY FirstName, LastName`
- Disciplines: `SELECT DisciplineID AS id, DisciplineName AS code, DisciplineName AS name FROM dbo.Disciplines ORDER BY DisciplineName`
- DatasheetSubtypes: `SELECT DatasheetSubtypeID AS id, DisciplineID AS disciplineId, SubtypeName AS code, SubtypeName AS name FROM dbo.DatasheetSubtypes ORDER BY DisciplineID, SubtypeName`

**fetchAllFilled (filledSheetService.ts):** Same structure as fetchAllTemplates but `WHERE s.IsTemplate = 0` and FROM/JOINs included Disciplines/DatasheetSubtypes.

### 1c. Tables referenced for DisciplineName/SubtypeName

- **List queries:** `Sheets` (s.DisciplineID, s.DatasheetSubtypeID), `dbo.Disciplines` (d.DisciplineName), `dbo.DatasheetSubtypes` (ds.SubtypeName).
- **Reference-options:** `dbo.Disciplines` (DisciplineName), `dbo.DatasheetSubtypes` (SubtypeName, DatasheetSubtypeID, DisciplineID).

### 1d. Intended lookup tables (from repo)

- **Disciplines:** docs/phase1/chunk5-seeds.sql and verify-discipline-schema.sql assume columns: `DisciplineID`, `DisciplineName`.
- **DatasheetSubtypes:** assume `DatasheetSubtypeID`, `DisciplineID`, `SubtypeName`.
- **Sheets:** docs assume columns `DisciplineID`, `DatasheetSubtypeID` (verify-discipline-schema.sql). No migration in repo adds these; they may be missing in the live DB.

---

## 2. Schema verification (no code changes to app SQL)

- **Existing:** Run `docs/phase1/verify-discipline-schema.sql` in SSMS/sqlcmd to confirm Disciplines/DatasheetSubtypes exist and Sheets has DisciplineID/DatasheetSubtypeID.
---

## 3. Minimal fix implementation

### 3a. List endpoints (templates + filled sheets)

- Removed from SQL: `s.DisciplineID`, `s.DatasheetSubtypeID`, and the LEFT JOINs to `dbo.Disciplines` and `dbo.DatasheetSubtypes`.
- After the query, each row is mapped to include `disciplineId`, `disciplineName`, `subtypeId`, `subtypeName` as `null`, so the API shape is unchanged and clients do not break.

### 3b. Reference-options (templates only)

- Disciplines and DatasheetSubtypes queries are run with `.then(r => r.recordset ?? []).catch(() => [])`. If the table/column does not exist, the endpoint still returns 200 with `disciplines: []` and `subtypes: []`.

### 3c. Filters

- No list filters were added; existing behavior preserved. When you later add discipline/subtype filters, apply them only when a filter value is provided.

---

## 4. SQL before/after (Phase 1 schema: Name, SubtypeID)

### GET /api/backend/templates (fetchAllTemplates)

**Before (wrong columns):** Used `s.DatasheetSubtypeID`, `d.DisciplineName`, `ds.SubtypeName`, `LEFT JOIN dbo.DatasheetSubtypes ds ON s.DatasheetSubtypeID = ds.DatasheetSubtypeID`.

**After (correct):**
```sql
SELECT 
  s.SheetID AS sheetId,
  s.SheetName AS sheetName,
  s.SheetDesc AS sheetDesc,
  s.CategoryID AS categoryId,
  c.CategoryName AS categoryName,
  s.PreparedByID AS preparedById,
  u.FirstName + ' ' + u.LastName AS preparedByName,
  s.RevisionDate AS revisionDate,
  s.Status AS status,
  s.DisciplineID AS disciplineId,
  d.Name AS disciplineName,
  s.SubtypeID AS subtypeId,
  st.Name AS subtypeName
FROM Sheets s
LEFT JOIN Categories c ON s.CategoryID = c.CategoryID
LEFT JOIN Users u ON s.PreparedByID = u.UserID
LEFT JOIN dbo.Disciplines d ON d.DisciplineID = s.DisciplineID
LEFT JOIN dbo.DatasheetSubtypes st ON st.SubtypeID = s.SubtypeID
WHERE s.IsTemplate = 1
ORDER BY s.SheetID DESC
```
Return `result.recordset ?? []` (no mapping to null).

### GET /api/backend/templates/reference-options (fetchTemplateReferenceOptions)

**Before (wrong columns):** `DisciplineName`, `SubtypeName`, `DatasheetSubtypeID`; errors were swallowed with `.catch(() => [])`.

**After (correct):**
- Disciplines: `SELECT DisciplineID AS id, Name AS code, Name AS name FROM dbo.Disciplines ORDER BY Name`
- DatasheetSubtypes: `SELECT SubtypeID AS id, DisciplineID AS disciplineId, Name AS code, Name AS name FROM dbo.DatasheetSubtypes ORDER BY DisciplineID, Name`
- No `.catch(() => [])`; DB errors propagate (typed AppError from controller).

### GET /api/backend/filledsheets (fetchAllFilled)

**Before (wrong columns):** Same as templates list but with `DatasheetSubtypeID`, `DisciplineName`, `SubtypeName`.

**After (correct):**
```sql
SELECT 
  s.SheetID AS sheetId,
  ...,
  s.DisciplineID AS disciplineId,
  d.Name AS disciplineName,
  s.SubtypeID AS subtypeId,
  st.Name AS subtypeName
FROM Sheets s
LEFT JOIN ... 
LEFT JOIN dbo.Disciplines d ON d.DisciplineID = s.DisciplineID
LEFT JOIN dbo.DatasheetSubtypes st ON st.SubtypeID = s.SubtypeID
WHERE s.IsTemplate = 0
ORDER BY s.SheetID DESC
```
Return `result.recordset ?? []`.

---

## 5. Files changed

| File | Change |
|------|--------|
| `src/backend/services/templateService.ts` | fetchTemplateReferenceOptions: use `Name` (not DisciplineName/SubtypeName), `SubtypeID` (not DatasheetSubtypeID); no catch(() => []). fetchAllTemplates: LEFT JOIN Disciplines d, DatasheetSubtypes st; SELECT s.DisciplineID, d.Name AS disciplineName, s.SubtypeID, st.Name AS subtypeName; return recordset. |
| `src/backend/services/filledSheetService.ts` | fetchAllFilled: same list SQL with d.Name AS disciplineName, st.Name AS subtypeName, JOINs on DisciplineID/SubtypeID; return recordset. |
| `src/backend/routes/devRoutes.ts` | Removed GET /api/backend/dev/schema-columns (not needed for Phase 1 stability). |
| `tests/api/datasheets.templates.test.ts` | List: assert disciplineName/subtypeName when DB returns IDs; assert null when DisciplineID/SubtypeID null. Reference-options: assert items have id, name, code and do not have DisciplineName/SubtypeName. |
| `tests/api/datasheets.filled.test.ts` | List: same disciplineName/subtypeName and null-safe assertions. |

---

## 6. Tests

- **datasheets.templates.test.ts:** GET templates returns 200 and array with optional discipline fields; GET reference-options returns 200 with disciplines/subtypes as arrays (may be empty), and when non-empty asserts id/name (and disciplineId for subtypes).
- **datasheets.filled.test.ts:** GET filledsheets returns 200 and array with optional discipline fields (unchanged).

No new integration DB tests; existing mocks keep the suite deterministic.

---

## 7. PowerShell verification

```powershell
# 1) Backend tests (template + filled list/reference)
Set-Location c:\Users\jmjab\Desktop\nextjs\specverse
npm run test -- tests/api/datasheets.templates.test.ts tests/api/datasheets.filled.test.ts

# 2) Start server (in another terminal; requires DB)
$env:DEV_ADMIN_UTILS = "1"
npm run backend

# 3) Manual checks (with auth cookie from login or use a test token)
# Replace BASE and COOKIE as needed.
$base = "http://localhost:3001"
$cookie = "token=YOUR_JWT"

Invoke-WebRequest -Uri "$base/api/backend/templates" -WebSession (New-Object Microsoft.PowerShell.Commands.WebRequestSession) -Headers @{ Cookie = $cookie } -UseBasicParsing
Invoke-WebRequest -Uri "$base/api/backend/templates/reference-options" -Headers @{ Cookie = $cookie } -UseBasicParsing
Invoke-WebRequest -Uri "$base/api/backend/filledsheets" -Headers @{ Cookie = $cookie } -UseBasicParsing

```

---

## 8. Phase 1 schema (current)

List and reference-options now use the confirmed schema: `Sheets.DisciplineID`/`SubtypeID`, `Disciplines.Name`, `DatasheetSubtypes.SubtypeID`/`Name`. No further column-name changes needed for Phase 1 stability.

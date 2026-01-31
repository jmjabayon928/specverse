# Phase 2: Validation and Implementation Sequence

**Purpose:** Validate migration and data model against the repo and current DB usage; lock schema details, minimal adjustments, and final implementation order. No backend/frontend implementation in this step.

---

## 1) Schema Reality Check

### 1.1 Do Phase 2 tables/indexes already exist?

| Object | In repo migrations | In code (non–Phase 2) | Conclusion |
|--------|--------------------|------------------------|------------|
| **dbo.ValueContexts** | Only in [migrations/phase2_value_contexts_and_valuesets.sql](migrations/phase2_value_contexts_and_valuesets.sql) | Not referenced | Does not exist in DB yet. |
| **dbo.InformationValueSets** | Same file | Not referenced | Does not exist in DB yet. |
| **dbo.ValueSetFieldVariances** | Same file | Not referenced | Does not exist in DB yet. |
| **InformationValues.ValueSetID** | Same migration (add column) | Not referenced | Column does not exist yet. |

No other migrations (e.g. [add_sheet_revisions_table.sql](migrations/add_sheet_revisions_table.sql), [add_export_jobs_table.sql](migrations/add_export_jobs_table.sql), [add_inventory_transactions_indexes.sql](migrations/add_inventory_transactions_indexes.sql)) reference ValueContexts, InformationValueSets, ValueSetFieldVariances, or ValueSetID.

### 1.2 Idempotency and name conflicts

- **Forward migration** uses:
  - `IF OBJECT_ID(N'dbo.ValueContexts', N'U') IS NULL` before CREATE TABLE
  - `IF NOT EXISTS (SELECT 1 FROM dbo.ValueContexts WHERE Code = N'...')` before each seed INSERT
  - `IF OBJECT_ID(N'dbo.InformationValueSets', N'U') IS NULL` before CREATE TABLE
  - `IF COL_LENGTH(N'dbo.InformationValues', N'ValueSetID') IS NULL` before ADD column
  - `IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE ... name = 'FK_InformationValues_ValueSetID')` before ADD CONSTRAINT
  - `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE ... name = N'UQ_InformationValues_...')` before CREATE INDEX
  - `IF OBJECT_ID(N'dbo.ValueSetFieldVariances', N'U') IS NULL` before CREATE TABLE

Re-running the forward migration is safe; it will not duplicate tables, seed rows, column, FK, or indexes. No existing index or constraint in the repo uses the names `UX_InfoValues_ValueSet_InfoTemplate`, `UX_InfoValues_Sheet_InfoTemplate_Legacy`, or `FK_InformationValues_ValueSetID`.

### 1.3 Exact column names to use in code

Use these names consistently in backend and migrations:

| Table / scope | Column / name | Notes |
|---------------|----------------|-------|
| **ValueContexts** | **ContextID** (PK) | Not ValueContextID. |
| **ValueContexts** | Code, Name, SortOrder | Seed: Requirement, Offered, AsBuilt. |
| **InformationValueSets** | **ValueSetID** (PK), **SheetID**, **ContextID**, **PartyID**, **Status**, CreatedAt, CreatedBy, UpdatedAt, UpdatedBy | Status: Draft \| Locked \| Verified. |
| **InformationValues** | **ValueSetID** (nullable FK) | New column; legacy rows keep NULL. |
| **InformationValues** | InfoTemplateID, SheetID, InfoValue(, UOM) | Existing; Phase 2 writes may add UOM — see §3. |
| **ValueSetFieldVariances** | **ValueSetID**, **InfoTemplateID** (PK), VarianceStatus, ReviewedBy, ReviewedAt | VarianceStatus: DeviatesAccepted \| DeviatesRejected. |

---

## 2) Parties FK Plan

### 2.1 Does dbo.Parties exist?

- **Repo:** No migration and no backend code references **dbo.Parties** or **PartyID** except the commented block in [migrations/phase2_value_contexts_and_valuesets.sql](migrations/phase2_value_contexts_and_valuesets.sql) (lines 64–69).
- **Conclusion:** **Parties is not guaranteed to exist.** Assume it may be added later (e.g. reference data or separate migration).

### 2.2 Keep FK commented in main forward migration

- The main Phase 2 migration **must not** add `FK_InformationValueSets_PartyID` by default, so it does not depend on dbo.Parties.
- Keep the existing commented block as-is (optional FK when Parties exists).

### 2.3 Follow-up migration: add Parties FK when table exists

Add a **separate** migration (e.g. `phase2_add_parties_fk.sql`) to be run only when **dbo.Parties** exists and has a **PartyID** column. That migration should:

1. **Orphan check (run first; fail or report before adding FK):**

```sql
-- Orphan check: InformationValueSets.PartyID not in Parties
IF EXISTS (
    SELECT 1 FROM dbo.InformationValueSets ivs
    LEFT JOIN dbo.Parties p ON p.PartyID = ivs.PartyID
    WHERE ivs.PartyID IS NOT NULL AND p.PartyID IS NULL
)
    RAISERROR('Orphan PartyID found in InformationValueSets. Resolve before adding FK.', 16, 1);
```

2. **Add FK only if Parties exists and no orphans:**

```sql
IF OBJECT_ID(N'dbo.Parties', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InformationValueSets') AND name = 'FK_InformationValueSets_PartyID')
BEGIN
    ALTER TABLE dbo.InformationValueSets
    ADD CONSTRAINT FK_InformationValueSets_PartyID FOREIGN KEY (PartyID) REFERENCES dbo.Parties(PartyID);
END
```

- **Location:** e.g. [migrations/phase2_add_parties_fk.sql](migrations/phase2_add_parties_fk.sql) (to be added when implementing this step).
- **Order:** Run after `phase2_value_contexts_and_valuesets.sql` and after **dbo.Parties** is created and populated.

---

## 3) UOM Reality Check (Critical)

### 3.1 Where InformationValues are written today

| Location | What is written | UOM written? |
|----------|-----------------|--------------|
| [src/backend/services/filledSheetService.ts](src/backend/services/filledSheetService.ts) | `insertInfoValue`: INSERT (InfoTemplateID, SheetID, InfoValue) — lines 519–531 (create path) | **No** |
| [src/backend/services/filledSheetService.ts](src/backend/services/filledSheetService.ts) | Update path: DELETE then INSERT (InfoTemplateID, SheetID, InfoValue) — lines 1186–1191 | **No** |
| [src/backend/services/revisionService.ts](src/backend/services/revisionService.ts) | INSERT (InfoTemplateID, SheetID, RevisionID, InfoValue1, UOM1, InfoValue2, UOM2) — lines 35–36 | Uses **UOM1/UOM2** (revision columns), not **UOM** |

So in the **main create/update filled-sheet path**, **UOM is never written** to InformationValues; only **InfoValue** is. Revision path uses different columns (UOM1, UOM2).

### 3.2 Where UOM is read from

| Location | Source of UOM |
|----------|----------------|
| [src/backend/services/filledSheetService.ts](src/backend/services/filledSheetService.ts) getFilledSheetDetailsById (lines 663–681) | **t.UOM** (InformationTemplates) in SELECT; **iv.InfoValue** from InformationValues. UOM in response is from **template**, not from IV. |
| [src/backend/services/filledSheetService.ts](src/backend/services/filledSheetService.ts) update oldValuesMap (lines 1150–1162) | **IT.UOM** (InformationTemplates) in SELECT; used for change log only. |
| [src/backend/services/layoutService.ts](src/backend/services/layoutService.ts) render (lines 1266, 1276–1278) | **COALESCE(ivTop.UOM, it.UOM)** and **v.UOM** from InformationValues in OUTER APPLY. So **layoutService expects a UOM column on InformationValues**; today it is likely NULL for main path. |
| [src/backend/database/informationQueries.ts](src/backend/database/informationQueries.ts) getInformationBySubSheetId (lines 16–19) | **V.InfoValue, V.UOM** — reads UOM from InformationValues. |
| [src/backend/database/datasheetQueries.ts](src/backend/database/datasheetQueries.ts) getInformationBySubSheetId (line 57) | **it.UOM** (template only); does not select iv.UOM. |

**Conclusion:** UOM is **read** from InformationValues in **layoutService** and **informationQueries**, but **never written** in filledSheetService. So for the main path, InformationValues.UOM is likely NULL and display falls back to template UOM where COALESCE is used.

### 3.3 Minimal changes for Phase 2

**Goal:** (1) Requirement set stores UOM consistently. (2) Offered prefill copies InfoValue + UOM correctly.

**Assumption:** InformationValues has (or will have) a **UOM** column (nullable). If it does not exist, add it in a migration (e.g. `ALTER TABLE InformationValues ADD UOM VARCHAR(50) NULL`) before Phase 2 value writes.

**Backend (minimal):**

1. **Requirement / Offered writes (create and update):** When inserting or updating rows in InformationValues, set **UOM** from the **template** for that InfoTemplateID (e.g. `SELECT UOM FROM InformationTemplates WHERE InfoTemplateID = @InfoTemplateID`), or from the request when we later support per-value UOM override.
2. **insertInfoValue** (and the update-path INSERT): Extend signature/query to accept optional UOM; if not provided, resolve from InformationTemplates by InfoTemplateID and write (InfoTemplateID, SheetID, InfoValue, UOM) so that Requirement set stores UOM.
3. **Offered prefill (SQL):** When copying Requirement → Offered, copy **InfoValue** and **UOM** (if the column exists). Use `INSERT INTO ... SELECT InfoTemplateID, @NewValueSetID, InfoValue, UOM FROM InformationValues WHERE ValueSetID = @RequirementValueSetID` (and SheetID if still used); do not copy RevisionID/InfoValue1/UOM1/InfoValue2/UOM2 for the new ValueSet rows.

**Request payload shape:**

- **Current:** `fieldValues` is `Record<string, string>` (field id → value string). No UOM in payload.
- **Phase 2 (minimal):** No change to payload for UOM. Backend derives UOM from **InformationTemplates.UOM** when writing Requirement/Offered. Optional future: add `fieldUom?: Record<string, string>` for override.

**Summary:** Ensure InformationValues has a UOM column; when writing any value row (create/update/prefill), set UOM from template (or future payload override). Prefill copy includes UOM.

---

## 4) Backfill Strategy

### 4.1 Backfill script logic

- **Script:** [migrations/phase2_backfill_requirement_valuesets.sql](migrations/phase2_backfill_requirement_valuesets.sql).
- **Logic:** For each distinct **SheetID** that has rows in **InformationValues** with **ValueSetID IS NULL**, and for which **Sheets.IsTemplate = 0** (lines 22–26), get or create one **InformationValueSet** (ContextID = Requirement, PartyID NULL), then **UPDATE InformationValues SET ValueSetID = @ValueSetID WHERE SheetID = @SheetID AND ValueSetID IS NULL** (lines 43–46).
- **Templates:** Cursor explicitly filters `EXISTS (SELECT 1 FROM dbo.Sheets s WHERE s.SheetID = iv.SheetID AND s.IsTemplate = 0)`, so **templates (IsTemplate = 1) are skipped**; only filled sheets are backfilled.
- **Re-run:** Safe; only creates ValueSets when missing and only updates rows where ValueSetID IS NULL.

### 4.2 Confirmation

- Backfill creates one Requirement ValueSet per filled sheet that has legacy value rows and sets ValueSetID on those rows.
- It does not touch template sheets. No change needed for backfill logic.

---

## 5) Final Implementation Sequence

Ordered, small-PR-sized steps:

1. **DB migrations**
   - Run [migrations/phase2_value_contexts_and_valuesets.sql](migrations/phase2_value_contexts_and_valuesets.sql) (ValueContexts, InformationValueSets, InformationValues.ValueSetID, indexes, ValueSetFieldVariances). Keep Parties FK commented.
   - Optionally add migration to ensure **InformationValues.UOM** column exists (ADD if COL_LENGTH is NULL).
   - Run [migrations/phase2_backfill_requirement_valuesets.sql](migrations/phase2_backfill_requirement_valuesets.sql) after deploy if legacy rows must be backfilled immediately; otherwise run later.
   - Add [migrations/phase2_add_parties_fk.sql](migrations/phase2_add_parties_fk.sql) (orphan check + add FK when Parties exists) for use when dbo.Parties is available.

2. **Backend: value set creation + reads**
   - Domain/types: ValueContext, InformationValueSet, value set DTOs; use **ContextID**, **ValueSetID**, **PartyID**, **Status**.
   - DB: valueSetQueries (or equivalent) — get ValueContext by Code; ensure Requirement ValueSet for sheet; get ValueSet by (sheetId, contextCode, partyId); get values by ValueSetID; read InformationValues with ValueSetID/InfoTemplateID/InfoValue/UOM.
   - Service: ensureRequirementValueSet(sheetId); getValueSet(sheetId, contextCode, partyId?); getValuesForValueSet(valueSetId).
   - Wire Phase 1 GET/PUT filled sheet to Requirement ValueSet (resolve or create Requirement ValueSet; read/write values with ValueSetID). Ensure all value writes set UOM from template when writing to InformationValues.

3. **Backend: offered prefill**
   - createOfferedValueSet(sheetId, partyId): create InformationValueSet (Offered, partyId); copy rows from Requirement ValueSet into new ValueSet (INSERT ... SELECT InfoTemplateID, @NewValueSetID, InfoValue, UOM, ... WHERE ValueSetID = @RequirementValueSetID); return valueSetId.
   - API: POST /api/backend/sheets/:sheetId/valuesets (body: contextCode, partyId?) → create or get ValueSet; when Offered, perform prefill.

4. **Backend: variance + status transitions**
   - ValueSetFieldVariances: upsert (ValueSetID, InfoTemplateID, VarianceStatus); reject when ValueSet.Status != Draft.
   - transitionStatus(valueSetId, targetStatus): validate Draft → Locked or Draft → Verified per context; update InformationValueSets.Status; reject value/variance writes when Status != Draft.
   - API: PATCH variance; POST status transition. Middleware or service: block value/variance updates when Status is Locked/Verified.

5. **Frontend: context + party selectors**
   - Context selector (Requirement / Offered / As-Built); party selector when context = Offered. Load values by (sheetId, context, partyId). Persist selected context/party in URL or state. Call GET filled sheet (or new GET values endpoint) with context/party.

6. **Frontend: compare view**
   - Read-only compare page: request compare endpoint (matrix: field × context/party); render table with variance indicators; optional Accept/Reject wired to variance PATCH.

7. **Tests**
   - Backend: create Offered ValueSet → prefill copies Requirement values (and UOM); write rejected when Status is Locked/Verified; variance PATCH creates/updates row; compare endpoint returns stable shape. Strict TS; no `any`; early returns.

---

## Summary

| Item | Status / adjustment |
|------|----------------------|
| **Phase 2 tables** | Not in DB yet; only in phase2 migration; forward migration is idempotent. |
| **Column names** | Use **ContextID**, **ValueSetID**, **PartyID**, **Status**; **ValueSetID** on InformationValues. |
| **Parties FK** | Not guaranteed; keep commented in main migration; add separate migration with orphan check when Parties exists. |
| **UOM** | Not written today in filledSheetService; add UOM to INSERT (from template); prefill copies InfoValue + UOM; ensure InformationValues has UOM column. |
| **Backfill** | Correct; skips IsTemplate = 1. |
| **Implementation order** | (1) DB migrations (2) value set creation + reads (3) offered prefill (4) variance + status (5) frontend selectors (6) compare view (7) tests. |

**Operations runbook:** See [phase2-ops.md](phase2-ops.md) for how to run forward migration + backfill, create Offered/As-Built sets, and known limitations.

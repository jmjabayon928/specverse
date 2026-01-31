# Phase 2 Slice #1: DB Migrations — Deliverables and Verification

## List of migration files (created/edited)

| File | Action | Description |
|------|--------|--------------|
| [migrations/phase2_value_contexts_and_valuesets.sql](migrations/phase2_value_contexts_and_valuesets.sql) | **Edited** | Forward migration: ValueContexts, InformationValueSets, InformationValues (ValueSetID + UOM), ValueSetFieldVariances; UOM backfill; FK ReviewedBy when Users exists. |
| [migrations/phase2_value_contexts_and_valuesets_rollback.sql](migrations/phase2_value_contexts_and_valuesets_rollback.sql) | **Edited** | Rollback: drop in reverse order; note that UOM column is not dropped. |
| [migrations/phase2_backfill_requirement_valuesets.sql](migrations/phase2_backfill_requirement_valuesets.sql) | **Edited** | Backfill: one Requirement ValueSet per filled sheet with legacy rows; set ValueSetID; skip templates (IsTemplate = 0). Comment only. |
| [migrations/phase2_add_parties_fk.sql](migrations/phase2_add_parties_fk.sql) | **No change** | Follow-up: orphan check then add FK InformationValueSets.PartyID → Parties(PartyID) when dbo.Parties exists. |

---

## Per-file summary and key SQL

### 1. phase2_value_contexts_and_valuesets.sql

**ValueContexts**

- Create table if not exists: **ContextID** (PK), **Code**, **Name**, **SortOrder**, **CreatedAt**, **UpdatedAt**. Unique on Code.
- If table exists, add CreatedAt/UpdatedAt if missing.
- Seed exactly three rows: (`Requirement`, `Purchaser Requirement`, 1), (`Offered`, `Vendor Offered`, 2), (`AsBuilt`, `As-Built / Verified`, 3).

**InformationValueSets**

- Create if not exists: **ValueSetID** (PK), **SheetID**, **ContextID**, **PartyID** (NULL), **Status** (default `Draft`), **CreatedAt**, **CreatedBy**, **UpdatedAt**, **UpdatedBy**.
- FK SheetID → Sheets(SheetID) ON DELETE CASCADE, FK ContextID → ValueContexts(ContextID). Party FK **commented** in this script.
- Filtered unique indexes:
  - `(SheetID, ContextID, PartyID) WHERE PartyID IS NOT NULL`
  - `(SheetID, ContextID) WHERE PartyID IS NULL`
- If table already exists, create the two filtered unique indexes if missing (idempotent).

**InformationValues**

- Add **ValueSetID** INT NULL, FK → InformationValueSets(ValueSetID).
- Filtered unique indexes (created only after ValueSetID exists; names: UX_InfoValues_ValueSet_InfoTemplate, UX_InfoValues_Sheet_InfoTemplate_Legacy):
  - `(ValueSetID, InfoTemplateID) WHERE ValueSetID IS NOT NULL`
  - `(SheetID, InfoTemplateID) WHERE ValueSetID IS NULL`

**UOM hardening**

- Add **UOM** NVARCHAR(50) NULL if column missing.
- Backfill: `UPDATE iv SET iv.UOM = it.UOM FROM InformationValues iv INNER JOIN InformationTemplates it ON it.InfoTemplateID = iv.InfoTemplateID WHERE iv.UOM IS NULL`.

**ValueSetFieldVariances**

- Create if not exists: PK(**ValueSetID**, **InfoTemplateID**), **VarianceStatus** (`DeviatesAccepted` | `DeviatesRejected`), **ReviewedBy**, **ReviewedAt** (nullable).
- FK ValueSetID → InformationValueSets ON DELETE CASCADE, FK InfoTemplateID → InformationTemplates.
- If dbo.Users exists, add FK **ReviewedBy** → Users(UserID).

---

### 2. phase2_value_contexts_and_valuesets_rollback.sql

- Drop **ValueSetFieldVariances** (table).
- Drop indexes on **InformationValues**: `UQ_InformationValues_ValueSetID_InfoTemplateID`, `UQ_InformationValues_SheetID_InfoTemplateID_Legacy`.
- Drop FK **FK_InformationValues_ValueSetID**, then column **ValueSetID**.
- Drop **InformationValueSets** (table; indexes drop with it).
- Drop **ValueContexts** (table).
- **UOM column on InformationValues is not dropped** (documented in script comment).

---

### 3. phase2_backfill_requirement_valuesets.sql

- Prerequisite: ValueContexts seeded with Code = `Requirement`.
- Cursor over distinct SheetID from InformationValues where ValueSetID IS NULL and sheet is filled (`EXISTS ... Sheets ... IsTemplate = 0`).
- For each: get or insert one InformationValueSet (SheetID, ContextID = Requirement, PartyID NULL, Status Draft); UPDATE InformationValues SET ValueSetID = @ValueSetID WHERE SheetID = @SheetID AND ValueSetID IS NULL.
- Safe to re-run (only creates/updates where ValueSetID IS NULL).

---

### 4. phase2_add_parties_fk.sql

- If dbo.Parties does not exist: PRINT and RETURN.
- Orphan check: RAISERROR if any InformationValueSets.PartyID is non-NULL and not in Parties.
- If FK `FK_InformationValueSets_PartyID` does not exist: ALTER TABLE InformationValueSets ADD CONSTRAINT ... FOREIGN KEY (PartyID) REFERENCES dbo.Parties(PartyID).

---

## Verification steps

### Run order (forward)

1. **Forward migration**
   - Run `phase2_value_contexts_and_valuesets.sql` against the target database (e.g. DataSheets).
   - Expect: ValueContexts created and seeded; InformationValueSets created with two filtered unique indexes; InformationValues has ValueSetID (nullable) and UOM (added/backfilled); ValueSetFieldVariances created; optional FK ReviewedBy if Users exists.
   - Re-run the same script: no errors; “already exists” / “already added” messages where applicable.

2. **Backfill (optional, when legacy rows exist)**
   - Run `phase2_backfill_requirement_valuesets.sql` after the forward migration.
   - Expect: One Requirement ValueSet per filled sheet that has InformationValues with ValueSetID NULL; those rows updated with ValueSetID; templates (IsTemplate = 1) untouched.
   - Re-run: no duplicate ValueSets; no errors.

3. **Parties FK (only when dbo.Parties exists)**
   - Run `phase2_add_parties_fk.sql` only after dbo.Parties exists and all non-NULL PartyID in InformationValueSets exist in Parties.
   - Expect: Orphan check passes; FK added. If Parties does not exist: script exits with message.

### Run order (rollback)

1. Run `phase2_value_contexts_and_valuesets_rollback.sql`.
2. Expect: ValueSetFieldVariances dropped; InformationValues indexes and FK and ValueSetID column dropped; InformationValueSets dropped; ValueContexts dropped. InformationValues.UOM is **not** dropped.

### Why the old migration sometimes skipped the InformationValues indexes

- **Ordering:** Index creation ran in separate GO batches right after the FK batch. If the FK batch failed (e.g. InformationValueSets not yet created, or a prior batch error), the script stopped before the index batches ran, so the indexes were never created.
- **No “column exists” guard:** The script did not check that the ValueSetID column existed before creating indexes that reference it. In some runs (e.g. partial re-run or different execution order), the index batches could run in a state where the column or table was not ready, causing failure or skip.
- **Name mismatch:** The migration used names like `UQ_InformationValues_ValueSetID_InfoTemplateID`. If indexes were later added manually with different names (e.g. `UX_InfoValues_ValueSet_InfoTemplate`), re-running the migration saw “index exists” only for the old names, so behavior depended on which names were present. The patch uses the canonical names `UX_InfoValues_ValueSet_InfoTemplate` and `UX_InfoValues_Sheet_InfoTemplate_Legacy` and creates both only when `ValueSetID` exists.

### Quick checks after forward

- `SELECT * FROM dbo.ValueContexts` — 3 rows (Requirement, Offered, AsBuilt).
- `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InformationValues' AND COLUMN_NAME IN ('ValueSetID','UOM')` — both columns present.
- `SELECT name FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.InformationValueSets') AND name LIKE 'UQ_%'` — two filtered unique indexes.
- After backfill: `SELECT COUNT(*) FROM dbo.InformationValues WHERE ValueSetID IS NULL` — 0 for filled sheets that had legacy rows (templates may still have NULL if they have value rows).

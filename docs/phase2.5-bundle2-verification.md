# Phase 2.5 Bundle 2 — Verification

**Status:** Verification checklist for Bundle 2 (AccountID columns, backfill, constraints/indexes).  
**Contracts:** `docs/phase2.5-tenant-model-and-table-scope.md`, `docs/phase2.5-implementation-plan.md`.

---

## 1) Confirm default AccountID

After Bundle 1 and before/after Bundle 2, the default account must exist:

```sql
USE DataSheets;

SELECT AccountID, AccountName, Slug, IsActive
FROM dbo.Accounts
WHERE Slug = N'default';
```

**Expected:** One row with `Slug = 'default'`. Note the `AccountID` (e.g. 1) for spot checks.

---

## 2) Counts of NULL AccountID (before vs after)

**Before running Bundle 2 backfill:** Any tenant-owned table that already has an `AccountID` column should show NULLs (if the column was just added).

**After running all Bundle 2 migrations:** No tenant-owned row should have `AccountID` NULL.

Run the following **after** `phase2_5_bundle2_backfill_accountid.sql` (and optionally after `phase2_5_bundle2_constraints_and_indexes.sql`):

```sql
USE DataSheets;

-- Tables that must have AccountID (tenant-owned)
DECLARE @tables TABLE (t SYSNAME);
INSERT INTO @tables (t) VALUES
 (N'Clients'),(N'Projects'),(N'Warehouses'),(N'Manufacturers'),(N'Suppliers'),(N'Areas'),
 (N'Sheets'),(N'SubSheets'),(N'InformationTemplates'),(N'InformationValues'),(N'InformationValueSets'),
 (N'ValueSetFieldVariances'),(N'SheetNotes'),(N'Attachments'),(N'SheetAttachments'),
 (N'DatasheetLayouts'),(N'LayoutRegions'),(N'LayoutBlocks'),(N'LayoutSubsheetSlots'),(N'LayoutBodySlots'),
 (N'SheetHeaderKV'),(N'InfoTemplateGrouping'),(N'SheetRevisions'),
 (N'ExportJobs'),(N'AuditLogs'),(N'ChangeLogs'),(N'Notifications'),(N'NotificationRecipients'),
 (N'InventoryItems'),(N'Inventory'),(N'InventoryTransactions'),(N'InventoryMaintenanceLogs'),(N'InventoryAuditLogs'),
 (N'Estimations'),(N'EstimationPackages'),(N'EstimationItems'),(N'EstimationItemSupplierQuotes'),
 (N'Parties'),(N'MirrorTemplates');

DECLARE @t SYSNAME, @sql NVARCHAR(MAX), @cnt INT;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT t FROM @tables;
OPEN c;
FETCH NEXT FROM c INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @t, N'U') IS NOT NULL AND COL_LENGTH(N'dbo.' + @t, N'AccountID') IS NOT NULL
    BEGIN
        SET @sql = N'SELECT @cnt = COUNT(*) FROM dbo.' + QUOTENAME(@t) + N' WHERE AccountID IS NULL';
        EXEC sp_executesql @sql, N'@cnt INT OUTPUT', @cnt = @cnt OUTPUT;
        IF @cnt > 0
            PRINT @t + N': ' + CAST(@cnt AS NVARCHAR(20)) + N' rows with NULL AccountID';
    END
    FETCH NEXT FROM c INTO @t;
END
CLOSE c;
DEALLOCATE c;
```

**Expected:** No output (zero NULLs). If any table prints a count, re-run the backfill or fix data.

---

## 3) Spot checks for key tables

Replace `@DefaultAccountID` with the actual default account ID (e.g. 1).

```sql
USE DataSheets;

DECLARE @DefaultAccountID INT = 1;  -- from step 1

-- All Sheets belong to default account
SELECT COUNT(*) AS TotalSheets,
       SUM(CASE WHEN AccountID = @DefaultAccountID THEN 1 ELSE 0 END) AS DefaultAccountSheets
FROM dbo.Sheets;

-- All Clients belong to default account
SELECT COUNT(*) AS TotalClients,
       SUM(CASE WHEN AccountID = @DefaultAccountID THEN 1 ELSE 0 END) AS DefaultAccountClients
FROM dbo.Clients;

-- ExportJobs
SELECT COUNT(*) AS TotalExportJobs,
       SUM(CASE WHEN AccountID = @DefaultAccountID THEN 1 ELSE 0 END) AS DefaultAccountJobs
FROM dbo.ExportJobs;

-- AuditLogs
SELECT COUNT(*) AS TotalAuditLogs,
       SUM(CASE WHEN AccountID = @DefaultAccountID THEN 1 ELSE 0 END) AS DefaultAccountLogs
FROM dbo.AuditLogs;
```

**Expected:** For each table, `Total*` = `DefaultAccount*` (all rows in default account).

---

## 4) Constraint and index existence

**Foreign keys:** Every tenant-owned table with `AccountID` should have `FK_<Table>_AccountID` → `Accounts(AccountID)`.

```sql
USE DataSheets;

SELECT OBJECT_NAME(fk.parent_object_id) AS TableName,
       fk.name AS FKName
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.Accounts')
ORDER BY TableName;
```

**Expected:** One row per tenant-owned table that has an `AccountID` column (e.g. Clients, Projects, Sheets, ExportJobs, AuditLogs, …).

**Account-scoped uniques:**

```sql
SELECT OBJECT_NAME(i.object_id) AS TableName, i.name AS IndexName
FROM sys.indexes i
WHERE i.is_unique = 1
  AND i.name IN (
    N'UQ_Clients_AccountID_ClientCode',
    N'UQ_Projects_AccountID_ProjNum',
    N'UQ_Manufacturers_AccountID_ManuName',
    N'UQ_Suppliers_AccountID_SuppCode',
    N'UQ_Areas_AccountID_AreaCode',
    N'UQ_Areas_AccountID_AreaName',
    N'UQ_Warehouses_AccountID_WarehouseName'
  )
ORDER BY TableName;
```

**Expected:** At least one row per table that has the corresponding columns (e.g. Clients, Projects, Manufacturers, Suppliers, Areas, Warehouses).

**AccountID indexes:**

```sql
SELECT OBJECT_NAME(i.object_id) AS TableName, i.name AS IndexName
FROM sys.indexes i
WHERE i.name LIKE N'IX_%AccountID%'
  AND i.object_id IN (
    OBJECT_ID(N'dbo.Sheets'), OBJECT_ID(N'dbo.ExportJobs'), OBJECT_ID(N'dbo.AuditLogs'),
    OBJECT_ID(N'dbo.Clients'), OBJECT_ID(N'dbo.Projects'), OBJECT_ID(N'dbo.Estimations'),
    OBJECT_ID(N'dbo.InventoryItems'), OBJECT_ID(N'dbo.Notifications')
  )
ORDER BY TableName, IndexName;
```

**Expected:** Multiple rows (e.g. IX_Sheets_AccountID, IX_ExportJobs_AccountID_CreatedAt, IX_AuditLogs_AccountID, …).

---

## 5) Rollback checklist

When rolling back Bundle 2, run in this order:

1. **rollback_phase2_5_bundle2_constraints_and_indexes.sql**  
   - Drops all `FK_*_AccountID` to `Accounts`, account-scoped uniques, and Bundle 2 indexes.

2. **rollback_phase2_5_bundle2_backfill_accountid.sql**  
   - No-op (documented). No row-level revert.

3. **rollback_phase2_5_bundle2_drop_accountid_columns.sql**  
   - Drops `AccountID` column from all tenant-owned tables.

**Verification after rollback:**

- No `AccountID` column on tenant-owned tables (except any table that had it from another source).
- No FK to `Accounts` from those tables.
- Application must not reference `AccountID` until Bundle 3/4 (backend wiring).

---

## 6) Tables that may need a decision

If a table was **not** in the migration list because it was ambiguous or missing from the codebase:

- **InformationTemplateOptions** — Included in migrations; if the table does not exist, the add/backfill/constraint steps skip it (idempotent).
- **EstimationSuppliers** — Referenced in estimation controller delete; included in migrations. If the table does not exist, steps skip it.
- **Parties** — Referenced in Phase 2 value sets; included. If it does not exist, steps skip it.

If you find other tables that store tenant-owned business data but are not in the Bundle 2 list, add them to a “needs decision” list and either extend the migrations or document the decision in this file.

---

## 7) SSMS run order (summary)

**Forward (apply Bundle 2):**

1. `migrations/phase2_5_bundle2_add_accountid_columns.sql`
2. `migrations/phase2_5_bundle2_backfill_accountid.sql`
3. `migrations/phase2_5_bundle2_constraints_and_indexes.sql`

**Rollback (undo Bundle 2):**

1. `migrations/rollback_phase2_5_bundle2_constraints_and_indexes.sql`
2. `migrations/rollback_phase2_5_bundle2_backfill_accountid.sql`
3. `migrations/rollback_phase2_5_bundle2_drop_accountid_columns.sql`

**Verification commands:** Use the SQL snippets in §§1–4 and §8 below in SSMS after running the forward migrations.

---

## 8) Operational notes

- **ALTER COLUMN NOT NULL:** The backfill script sets `AccountID` to NOT NULL on large tables (e.g. Sheets, AuditLogs, InformationValues). This can take a schema lock and block writers. Prefer running the backfill during off-hours or a maintenance window.
- **Rowcount checks:** Before running the backfill, you can estimate risk by checking row counts on tenant-owned tables. Large tables (e.g. AuditLogs, Sheets, InformationValues) are the main candidates for lock duration.
  ```sql
  SELECT OBJECT_NAME(object_id) AS TableName, SUM(row_count) AS ApproxRows
  FROM sys.dm_db_partition_stats
  WHERE object_id IN (OBJECT_ID(N'dbo.Sheets'), OBJECT_ID(N'dbo.AuditLogs'), OBJECT_ID(N'dbo.InformationValues'), OBJECT_ID(N'dbo.ExportJobs'))
    AND index_id IN (0, 1)
  GROUP BY object_id;
  ```
- **Chunk backfill (optional):** If you must avoid long-running single updates, you can backfill in chunks (e.g. by primary key range or TOP (N) in a loop). This is not implemented in the migration; a generic pattern is: in a loop, `UPDATE TOP (@ChunkSize) dbo.Table SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;` until `@@ROWCOUNT = 0`, with a short delay between iterations if desired. Prefer the single-statement backfill when acceptable.

---

## 9) Skip logs (PRINT warnings)

After running `phase2_5_bundle2_constraints_and_indexes.sql`, **scan the SSMS Messages tab** for any PRINT output that indicates a skipped step:

- **Skipping UNIQUE for &lt;Table&gt;: &lt;column&gt; column not found** — The account-scoped unique was not created because the required column (e.g. ClientCode, ProjNum, ManuName, SuppCode, AreaCode/AreaName, WarehouseName) does not exist on that table. Resolve schema or document as a known gap.

If you see such messages, note which account-scoped uniques were skipped and either add the missing column(s) and re-run the constraints script, or accept the skip and document it.

---

## 10) Verification: no CASCADE on AccountID FKs

Ensure no AccountID → Accounts(AccountID) foreign key uses ON DELETE CASCADE:

```sql
USE DataSheets;

SELECT OBJECT_NAME(fk.parent_object_id) AS TableName,
       fk.name AS FKName,
       fk.delete_referential_action_desc AS DeleteAction
FROM sys.foreign_keys fk
WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.Accounts')
  AND fk.name LIKE N'FK_%_AccountID'
ORDER BY TableName;
```

**Expected:** Every row shows `DeleteAction = NO_ACTION`. If any row shows `CASCADE`, the migration or another change introduced CASCADE; remove it (drop and re-create the FK with NO ACTION).

---

## 11) Verification: account-scoped uniques created vs skipped

List which account-scoped uniques exist (created) and which tables were eligible but have no such index (skipped or not applied):

```sql
USE DataSheets;

-- Created: tables that have one of the Bundle 2 account-scoped unique index names
SELECT OBJECT_NAME(i.object_id) AS TableName, i.name AS IndexName, N'Created' AS Status
FROM sys.indexes i
WHERE i.is_unique = 1
  AND i.name IN (
    N'UQ_Clients_AccountID_ClientCode',
    N'UQ_Projects_AccountID_ProjNum',
    N'UQ_Manufacturers_AccountID_ManuName',
    N'UQ_Suppliers_AccountID_SuppCode',
    N'UQ_Areas_AccountID_AreaCode',
    N'UQ_Areas_AccountID_AreaName',
    N'UQ_Warehouses_AccountID_WarehouseName'
  )
ORDER BY TableName;

-- Eligible but missing: tables that have AccountID but do not have the expected unique (spot check)
SELECT t.name AS TableName, N'Check' AS Note
FROM sys.tables t
INNER JOIN sys.columns c ON c.object_id = t.object_id AND c.name = N'AccountID'
WHERE t.name IN (N'Clients', N'Projects', N'Manufacturers', N'Suppliers', N'Areas', N'Warehouses')
  AND NOT EXISTS (
    SELECT 1 FROM sys.indexes i
    WHERE i.object_id = t.object_id AND i.is_unique = 1
      AND i.name IN (N'UQ_Clients_AccountID_ClientCode', N'UQ_Projects_AccountID_ProjNum',
                     N'UQ_Manufacturers_AccountID_ManuName', N'UQ_Suppliers_AccountID_SuppCode',
                     N'UQ_Areas_AccountID_AreaCode', N'UQ_Areas_AccountID_AreaName', N'UQ_Warehouses_AccountID_WarehouseName')
  )
ORDER BY t.name;
```

**Expected:** First result set shows all account-scoped uniques that were created. Second result set shows tables that have AccountID but no Bundle 2 unique (either skipped due to missing column or table not present); correlate with Messages-tab PRINT output.

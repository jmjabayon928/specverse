-- Rollback: Phase 2.5 Bundle 2 — constraints and indexes only
-- Run first when undoing Bundle 2. Drops FKs, account-scoped uniques, and Bundle 2 indexes.
-- Run before rollback_phase2_5_bundle2_backfill_accountid.sql and rollback_phase2_5_bundle2_drop_accountid_columns.sql.

USE DataSheets;
GO

-- =============================================================================
-- 1. Drop foreign keys FK_*_AccountID (must drop before dropping column)
-- =============================================================================

DECLARE @fk SYSNAME, @t SYSNAME, @sql NVARCHAR(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT OBJECT_NAME(fk.parent_object_id), fk.name
    FROM sys.foreign_keys fk
    WHERE fk.referenced_object_id = OBJECT_ID(N'dbo.Accounts')
      AND fk.name LIKE N'FK_%_AccountID';

OPEN cur;
FETCH NEXT FROM cur INTO @t, @fk;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' DROP CONSTRAINT ' + QUOTENAME(@fk);
    EXEC sp_executesql @sql;
    PRINT 'Dropped ' + @fk;
    FETCH NEXT FROM cur INTO @t, @fk;
END
CLOSE cur;
DEALLOCATE cur;
GO

-- =============================================================================
-- 2. Drop account-scoped unique indexes (Bundle 2 only)
-- =============================================================================

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Clients') AND name = N'UQ_Clients_AccountID_ClientCode')
    DROP INDEX UQ_Clients_AccountID_ClientCode ON dbo.Clients;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Projects') AND name = N'UQ_Projects_AccountID_ProjNum')
    DROP INDEX UQ_Projects_AccountID_ProjNum ON dbo.Projects;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Manufacturers') AND name = N'UQ_Manufacturers_AccountID_ManuName')
    DROP INDEX UQ_Manufacturers_AccountID_ManuName ON dbo.Manufacturers;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Suppliers') AND name = N'UQ_Suppliers_AccountID_SuppCode')
    DROP INDEX UQ_Suppliers_AccountID_SuppCode ON dbo.Suppliers;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Areas') AND name = N'UQ_Areas_AccountID_AreaCode')
    DROP INDEX UQ_Areas_AccountID_AreaCode ON dbo.Areas;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Areas') AND name = N'UQ_Areas_AccountID_AreaName')
    DROP INDEX UQ_Areas_AccountID_AreaName ON dbo.Areas;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Warehouses') AND name = N'UQ_Warehouses_AccountID_WarehouseName')
    DROP INDEX UQ_Warehouses_AccountID_WarehouseName ON dbo.Warehouses;

PRINT 'Dropped account-scoped uniques.';
GO

-- =============================================================================
-- 3. Drop Bundle 2 non-unique indexes (IX_*_AccountID*)
-- =============================================================================

DECLARE @idx SYSNAME, @t SYSNAME, @sql NVARCHAR(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT OBJECT_NAME(i.object_id), i.name
    FROM sys.indexes i
    WHERE i.name IN (
        N'IX_Sheets_AccountID', N'IX_Sheets_AccountID_Status',
        N'IX_ExportJobs_AccountID_CreatedAt',
        N'IX_AuditLogs_AccountID', N'IX_AuditLogs_AccountID_PerformedAt',
        N'IX_Clients_AccountID', N'IX_Projects_AccountID',
        N'IX_Manufacturers_AccountID', N'IX_Suppliers_AccountID', N'IX_Areas_AccountID', N'IX_Warehouses_AccountID',
        N'IX_Estimations_AccountID', N'IX_InventoryItems_AccountID', N'IX_Notifications_AccountID'
    )
    AND i.type > 0;

OPEN cur;
FETCH NEXT FROM cur INTO @t, @idx;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @sql = N'DROP INDEX ' + QUOTENAME(@idx) + N' ON dbo.' + QUOTENAME(@t);
    BEGIN TRY
        EXEC sp_executesql @sql;
        PRINT 'Dropped ' + @idx + ' on ' + @t;
    END TRY
    BEGIN CATCH
        PRINT 'Skip or error dropping ' + @idx + ': ' + ERROR_MESSAGE();
    END CATCH
    FETCH NEXT FROM cur INTO @t, @idx;
END
CLOSE cur;
DEALLOCATE cur;

PRINT 'Rollback Phase 2.5 Bundle 2 constraints and indexes: done.';
GO

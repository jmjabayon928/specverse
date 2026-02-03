-- Phase 2.5 Bundle 2: Backfill AccountID with default account and set NOT NULL
-- Contracts: docs/phase2.5-tenant-model-and-table-scope.md
-- Prerequisite: phase2_5_bundle2_add_accountid_columns.sql must be applied.
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run (no-op where already set).

USE DataSheets;
GO

-- =============================================================================
-- 1. Resolve default account; abort if missing
-- =============================================================================
DECLARE @DefaultAccountID INT;
SELECT TOP 1 @DefaultAccountID = AccountID FROM dbo.Accounts WHERE Slug = N'default';

IF @DefaultAccountID IS NULL
BEGIN
    RAISERROR(
        N'Phase 2.5 Bundle 2 backfill: Default account (Slug = ''default'') not found. Run Bundle 1 seed first.',
        16,
        1
    );
    RETURN;
END;

PRINT 'Default AccountID = ' + CAST(@DefaultAccountID AS NVARCHAR(20));
GO

-- =============================================================================
-- 2. Backfill: SET AccountID = default for all rows where AccountID IS NULL
--    (Only on tables that have the column and exist.)
-- =============================================================================

DECLARE @DefaultAccountID INT;
SELECT TOP 1 @DefaultAccountID = AccountID FROM dbo.Accounts WHERE Slug = N'default';

IF @DefaultAccountID IS NULL
BEGIN
    RAISERROR(
        N'Phase 2.5 Bundle 2 backfill: Default account (Slug = ''default'') not found in this batch. Run Bundle 1 seed first.',
        16,
        1
    );
    RETURN;
END

-- Reference
IF COL_LENGTH(N'dbo.Clients', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Clients SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Clients: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Projects', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Projects SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Projects: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Warehouses', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Warehouses SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Warehouses: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Manufacturers', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Manufacturers SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Manufacturers: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Suppliers', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Suppliers SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Suppliers: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Areas', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Areas SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Areas: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END

-- Sheets and descendants
IF COL_LENGTH(N'dbo.Sheets', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Sheets SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Sheets: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.SubSheets', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.SubSheets SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.SubSheets: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InformationTemplates', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InformationTemplates SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InformationTemplates: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InformationTemplateOptions', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InformationTemplateOptions SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InformationTemplateOptions: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InformationValues', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InformationValues SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InformationValues: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InformationValueSets', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InformationValueSets SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InformationValueSets: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.ValueSetFieldVariances', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.ValueSetFieldVariances SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.ValueSetFieldVariances: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.SheetNotes', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.SheetNotes SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.SheetNotes: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Attachments', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Attachments SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Attachments: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.SheetAttachments', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.SheetAttachments SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.SheetAttachments: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.DatasheetLayouts', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.DatasheetLayouts SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.DatasheetLayouts: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.LayoutRegions', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.LayoutRegions SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.LayoutRegions: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.LayoutBlocks', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.LayoutBlocks SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.LayoutBlocks: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.LayoutSubsheetSlots', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.LayoutSubsheetSlots SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.LayoutSubsheetSlots: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.LayoutBodySlots', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.LayoutBodySlots SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.LayoutBodySlots: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.SheetHeaderKV', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.SheetHeaderKV SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.SheetHeaderKV: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InfoTemplateGrouping', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InfoTemplateGrouping SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InfoTemplateGrouping: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.SheetRevisions', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.SheetRevisions SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.SheetRevisions: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END

-- Export, audit, notifications
IF COL_LENGTH(N'dbo.ExportJobs', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.ExportJobs SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.ExportJobs: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.AuditLogs', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.AuditLogs SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.AuditLogs: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.ChangeLogs', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.ChangeLogs SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.ChangeLogs: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Notifications', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Notifications SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Notifications: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.NotificationRecipients', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.NotificationRecipients SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.NotificationRecipients: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END

-- Inventory
IF COL_LENGTH(N'dbo.InventoryItems', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InventoryItems SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InventoryItems: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.Inventory', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Inventory SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Inventory: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InventoryTransactions', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InventoryTransactions SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InventoryTransactions: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InventoryMaintenanceLogs', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InventoryMaintenanceLogs SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InventoryMaintenanceLogs: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.InventoryAuditLogs', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.InventoryAuditLogs SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.InventoryAuditLogs: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END

-- Estimation
IF COL_LENGTH(N'dbo.Estimations', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Estimations SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Estimations: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.EstimationPackages', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.EstimationPackages SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.EstimationPackages: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.EstimationItems', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.EstimationItems SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.EstimationItems: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.EstimationItemSupplierQuotes', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.EstimationItemSupplierQuotes SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.EstimationItemSupplierQuotes: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.EstimationSuppliers', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.EstimationSuppliers SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.EstimationSuppliers: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END

-- Parties, MirrorTemplates
IF COL_LENGTH(N'dbo.Parties', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.Parties SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.Parties: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END
IF COL_LENGTH(N'dbo.MirrorTemplates', N'AccountID') IS NOT NULL
BEGIN
    UPDATE dbo.MirrorTemplates SET AccountID = @DefaultAccountID WHERE AccountID IS NULL;
    PRINT 'dbo.MirrorTemplates: backfilled ' + CAST(@@ROWCOUNT AS NVARCHAR(20)) + ' rows.';
END

PRINT 'Phase 2.5 Bundle 2 backfill: updates done.';
GO

-- =============================================================================
-- 3. Alter AccountID to NOT NULL (so FK can be added in constraints script)
--    Only where column exists and we can safely require NOT NULL
-- =============================================================================

DECLARE @sql NVARCHAR(MAX);

-- Tables that received AccountID in this bundle (same order as add script)
DECLARE @Tables TABLE (TableName SYSNAME);
INSERT INTO @Tables (TableName) VALUES
 (N'Clients'),(N'Projects'),(N'Warehouses'),(N'Manufacturers'),(N'Suppliers'),(N'Areas'),
 (N'Sheets'),(N'SubSheets'),(N'InformationTemplates'),(N'InformationTemplateOptions'),
 (N'InformationValues'),(N'InformationValueSets'),(N'ValueSetFieldVariances'),
 (N'SheetNotes'),(N'Attachments'),(N'SheetAttachments'),(N'DatasheetLayouts'),(N'LayoutRegions'),
 (N'LayoutBlocks'),(N'LayoutSubsheetSlots'),(N'LayoutBodySlots'),(N'SheetHeaderKV'),(N'InfoTemplateGrouping'),
 (N'SheetRevisions'),(N'ExportJobs'),(N'AuditLogs'),(N'ChangeLogs'),(N'Notifications'),(N'NotificationRecipients'),
 (N'InventoryItems'),(N'Inventory'),(N'InventoryTransactions'),(N'InventoryMaintenanceLogs'),(N'InventoryAuditLogs'),
 (N'Estimations'),(N'EstimationPackages'),(N'EstimationItems'),(N'EstimationItemSupplierQuotes'),(N'EstimationSuppliers'),
 (N'Parties'),(N'MirrorTemplates');

DECLARE @t SYSNAME;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT TableName FROM @Tables;

OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @t, N'U') IS NOT NULL AND COL_LENGTH(N'dbo.' + @t, N'AccountID') IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' ALTER COLUMN AccountID INT NOT NULL;';
        BEGIN TRY
            EXEC sp_executesql @sql;
            PRINT 'dbo.' + @t + ': AccountID set NOT NULL.';
        END TRY
        BEGIN CATCH
            PRINT 'dbo.' + @t + ': ALTER COLUMN failed (may have NULLs or missing column): ' + ERROR_MESSAGE();
        END CATCH
    END
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur;
DEALLOCATE cur;

PRINT 'Phase 2.5 Bundle 2 backfill: NOT NULL updates done.';
GO

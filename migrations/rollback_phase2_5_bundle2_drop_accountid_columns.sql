-- Rollback: Phase 2.5 Bundle 2 — drop AccountID column from all tenant-owned tables
-- Run after rollback_phase2_5_bundle2_constraints_and_indexes.sql (FKs must be dropped first).
-- Order: run constraints rollback first, then this script.

USE DataSheets;
GO

-- =============================================================================
-- Drop AccountID column from each table that has it (same list as add script)
-- =============================================================================

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
DECLARE @sql NVARCHAR(500);
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR SELECT TableName FROM @Tables;

OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(N'dbo.' + @t, N'U') IS NOT NULL AND COL_LENGTH(N'dbo.' + @t, N'AccountID') IS NOT NULL
    BEGIN
        SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@t) + N' DROP COLUMN AccountID;';
        BEGIN TRY
            EXEC sp_executesql @sql;
            PRINT 'Dropped AccountID from dbo.' + @t;
        END TRY
        BEGIN CATCH
            PRINT 'dbo.' + @t + ': drop column failed (drop FKs first): ' + ERROR_MESSAGE();
        END CATCH
    END
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur;
DEALLOCATE cur;

PRINT 'Rollback Phase 2.5 Bundle 2 drop AccountID columns: done.';
GO

-- Phase 2.5 Bundle 2: Add FK AccountID -> Accounts, account-scoped uniques, and indexes
-- Contracts: docs/phase2.5-tenant-model-and-table-scope.md
-- Prerequisite: phase2_5_bundle2_backfill_accountid.sql must be applied (AccountID NOT NULL).
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.

USE DataSheets;
GO

-- =============================================================================
-- 1. Foreign keys: AccountID -> Accounts(AccountID)
--    All FKs use default NO ACTION (no ON DELETE CASCADE).
-- =============================================================================

-- Helper pattern: add FK only if table has AccountID and FK does not exist
IF COL_LENGTH(N'dbo.Clients', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Clients') AND name = N'FK_Clients_AccountID')
BEGIN
    ALTER TABLE dbo.Clients ADD CONSTRAINT FK_Clients_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Clients_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Projects', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Projects') AND name = N'FK_Projects_AccountID')
BEGIN
    ALTER TABLE dbo.Projects ADD CONSTRAINT FK_Projects_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Projects_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Warehouses', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Warehouses') AND name = N'FK_Warehouses_AccountID')
BEGIN
    ALTER TABLE dbo.Warehouses ADD CONSTRAINT FK_Warehouses_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Warehouses_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Manufacturers', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Manufacturers') AND name = N'FK_Manufacturers_AccountID')
BEGIN
    ALTER TABLE dbo.Manufacturers ADD CONSTRAINT FK_Manufacturers_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Manufacturers_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Suppliers', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Suppliers') AND name = N'FK_Suppliers_AccountID')
BEGIN
    ALTER TABLE dbo.Suppliers ADD CONSTRAINT FK_Suppliers_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Suppliers_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Areas', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Areas') AND name = N'FK_Areas_AccountID')
BEGIN
    ALTER TABLE dbo.Areas ADD CONSTRAINT FK_Areas_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Areas_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Sheets', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Sheets') AND name = N'FK_Sheets_AccountID')
BEGIN
    ALTER TABLE dbo.Sheets ADD CONSTRAINT FK_Sheets_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Sheets_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.SubSheets', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.SubSheets') AND name = N'FK_SubSheets_AccountID')
BEGIN
    ALTER TABLE dbo.SubSheets ADD CONSTRAINT FK_SubSheets_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_SubSheets_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InformationTemplates', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InformationTemplates') AND name = N'FK_InformationTemplates_AccountID')
BEGIN
    ALTER TABLE dbo.InformationTemplates ADD CONSTRAINT FK_InformationTemplates_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InformationTemplates_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InformationTemplateOptions', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InformationTemplateOptions') AND name = N'FK_InformationTemplateOptions_AccountID')
BEGIN
    ALTER TABLE dbo.InformationTemplateOptions ADD CONSTRAINT FK_InformationTemplateOptions_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InformationTemplateOptions_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InformationValues', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InformationValues') AND name = N'FK_InformationValues_AccountID')
BEGIN
    ALTER TABLE dbo.InformationValues ADD CONSTRAINT FK_InformationValues_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InformationValues_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InformationValueSets', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InformationValueSets') AND name = N'FK_InformationValueSets_AccountID')
BEGIN
    ALTER TABLE dbo.InformationValueSets ADD CONSTRAINT FK_InformationValueSets_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InformationValueSets_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.ValueSetFieldVariances', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.ValueSetFieldVariances') AND name = N'FK_ValueSetFieldVariances_AccountID')
BEGIN
    ALTER TABLE dbo.ValueSetFieldVariances ADD CONSTRAINT FK_ValueSetFieldVariances_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_ValueSetFieldVariances_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.SheetNotes', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.SheetNotes') AND name = N'FK_SheetNotes_AccountID')
BEGIN
    ALTER TABLE dbo.SheetNotes ADD CONSTRAINT FK_SheetNotes_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_SheetNotes_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Attachments', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Attachments') AND name = N'FK_Attachments_AccountID')
BEGIN
    ALTER TABLE dbo.Attachments ADD CONSTRAINT FK_Attachments_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Attachments_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.SheetAttachments', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.SheetAttachments') AND name = N'FK_SheetAttachments_AccountID')
BEGIN
    ALTER TABLE dbo.SheetAttachments ADD CONSTRAINT FK_SheetAttachments_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_SheetAttachments_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.DatasheetLayouts', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.DatasheetLayouts') AND name = N'FK_DatasheetLayouts_AccountID')
BEGIN
    ALTER TABLE dbo.DatasheetLayouts ADD CONSTRAINT FK_DatasheetLayouts_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_DatasheetLayouts_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.LayoutRegions', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.LayoutRegions') AND name = N'FK_LayoutRegions_AccountID')
BEGIN
    ALTER TABLE dbo.LayoutRegions ADD CONSTRAINT FK_LayoutRegions_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_LayoutRegions_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.LayoutBlocks', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.LayoutBlocks') AND name = N'FK_LayoutBlocks_AccountID')
BEGIN
    ALTER TABLE dbo.LayoutBlocks ADD CONSTRAINT FK_LayoutBlocks_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_LayoutBlocks_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.LayoutSubsheetSlots', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.LayoutSubsheetSlots') AND name = N'FK_LayoutSubsheetSlots_AccountID')
BEGIN
    ALTER TABLE dbo.LayoutSubsheetSlots ADD CONSTRAINT FK_LayoutSubsheetSlots_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_LayoutSubsheetSlots_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.LayoutBodySlots', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.LayoutBodySlots') AND name = N'FK_LayoutBodySlots_AccountID')
BEGIN
    ALTER TABLE dbo.LayoutBodySlots ADD CONSTRAINT FK_LayoutBodySlots_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_LayoutBodySlots_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.SheetHeaderKV', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.SheetHeaderKV') AND name = N'FK_SheetHeaderKV_AccountID')
BEGIN
    ALTER TABLE dbo.SheetHeaderKV ADD CONSTRAINT FK_SheetHeaderKV_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_SheetHeaderKV_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InfoTemplateGrouping', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InfoTemplateGrouping') AND name = N'FK_InfoTemplateGrouping_AccountID')
BEGIN
    ALTER TABLE dbo.InfoTemplateGrouping ADD CONSTRAINT FK_InfoTemplateGrouping_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InfoTemplateGrouping_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.SheetRevisions', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.SheetRevisions') AND name = N'FK_SheetRevisions_AccountID')
BEGIN
    ALTER TABLE dbo.SheetRevisions ADD CONSTRAINT FK_SheetRevisions_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_SheetRevisions_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.ExportJobs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.ExportJobs') AND name = N'FK_ExportJobs_AccountID')
BEGIN
    ALTER TABLE dbo.ExportJobs ADD CONSTRAINT FK_ExportJobs_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_ExportJobs_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.AuditLogs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.AuditLogs') AND name = N'FK_AuditLogs_AccountID')
BEGIN
    ALTER TABLE dbo.AuditLogs ADD CONSTRAINT FK_AuditLogs_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_AuditLogs_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.ChangeLogs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.ChangeLogs') AND name = N'FK_ChangeLogs_AccountID')
BEGIN
    ALTER TABLE dbo.ChangeLogs ADD CONSTRAINT FK_ChangeLogs_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_ChangeLogs_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Notifications', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Notifications') AND name = N'FK_Notifications_AccountID')
BEGIN
    ALTER TABLE dbo.Notifications ADD CONSTRAINT FK_Notifications_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Notifications_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.NotificationRecipients', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.NotificationRecipients') AND name = N'FK_NotificationRecipients_AccountID')
BEGIN
    ALTER TABLE dbo.NotificationRecipients ADD CONSTRAINT FK_NotificationRecipients_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_NotificationRecipients_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InventoryItems', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InventoryItems') AND name = N'FK_InventoryItems_AccountID')
BEGIN
    ALTER TABLE dbo.InventoryItems ADD CONSTRAINT FK_InventoryItems_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InventoryItems_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Inventory', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Inventory') AND name = N'FK_Inventory_AccountID')
BEGIN
    ALTER TABLE dbo.Inventory ADD CONSTRAINT FK_Inventory_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Inventory_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InventoryTransactions', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InventoryTransactions') AND name = N'FK_InventoryTransactions_AccountID')
BEGIN
    ALTER TABLE dbo.InventoryTransactions ADD CONSTRAINT FK_InventoryTransactions_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InventoryTransactions_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InventoryMaintenanceLogs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InventoryMaintenanceLogs') AND name = N'FK_InventoryMaintenanceLogs_AccountID')
BEGIN
    ALTER TABLE dbo.InventoryMaintenanceLogs ADD CONSTRAINT FK_InventoryMaintenanceLogs_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InventoryMaintenanceLogs_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InventoryAuditLogs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InventoryAuditLogs') AND name = N'FK_InventoryAuditLogs_AccountID')
BEGIN
    ALTER TABLE dbo.InventoryAuditLogs ADD CONSTRAINT FK_InventoryAuditLogs_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_InventoryAuditLogs_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Estimations', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Estimations') AND name = N'FK_Estimations_AccountID')
BEGIN
    ALTER TABLE dbo.Estimations ADD CONSTRAINT FK_Estimations_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Estimations_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.EstimationPackages', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.EstimationPackages') AND name = N'FK_EstimationPackages_AccountID')
BEGIN
    ALTER TABLE dbo.EstimationPackages ADD CONSTRAINT FK_EstimationPackages_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_EstimationPackages_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.EstimationItems', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.EstimationItems') AND name = N'FK_EstimationItems_AccountID')
BEGIN
    ALTER TABLE dbo.EstimationItems ADD CONSTRAINT FK_EstimationItems_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_EstimationItems_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.EstimationItemSupplierQuotes', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.EstimationItemSupplierQuotes') AND name = N'FK_EstimationItemSupplierQuotes_AccountID')
BEGIN
    ALTER TABLE dbo.EstimationItemSupplierQuotes ADD CONSTRAINT FK_EstimationItemSupplierQuotes_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_EstimationItemSupplierQuotes_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.EstimationSuppliers', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.EstimationSuppliers') AND name = N'FK_EstimationSuppliers_AccountID')
BEGIN
    ALTER TABLE dbo.EstimationSuppliers ADD CONSTRAINT FK_EstimationSuppliers_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_EstimationSuppliers_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Parties', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Parties') AND name = N'FK_Parties_AccountID')
BEGIN
    ALTER TABLE dbo.Parties ADD CONSTRAINT FK_Parties_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_Parties_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.MirrorTemplates', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.MirrorTemplates') AND name = N'FK_MirrorTemplates_AccountID')
BEGIN
    ALTER TABLE dbo.MirrorTemplates ADD CONSTRAINT FK_MirrorTemplates_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID);
    PRINT 'FK_MirrorTemplates_AccountID added.';
END
GO

-- =============================================================================
-- 2. Account-scoped unique constraints
--    Column-safe: only create if table and referenced column(s) exist.
--    Legacy unique is dropped only when we are about to create the replacement.
-- =============================================================================

-- Clients: (AccountID, ClientCode)
IF OBJECT_ID(N'dbo.Clients', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Clients', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Clients') AND name = N'UQ_Clients_AccountID_ClientCode')
BEGIN
    IF COL_LENGTH(N'dbo.Clients', N'ClientCode') IS NOT NULL
    BEGIN
        -- Drop legacy unique on ClientCode only when creating replacement
        DECLARE @cn NVARCHAR(256);
        SELECT TOP 1 @cn = i.name FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID(N'dbo.Clients') AND i.is_unique = 1 AND c.name = N'ClientCode'
          AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic2 INNER JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id
                           WHERE ic2.object_id = OBJECT_ID(N'dbo.Clients') AND ic2.index_id = i.index_id AND c2.name = N'AccountID');
        IF @cn IS NOT NULL
            EXEC('ALTER TABLE dbo.Clients DROP CONSTRAINT ' + QUOTENAME(@cn));
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Clients_AccountID_ClientCode ON dbo.Clients (AccountID, ClientCode);
        PRINT 'UQ_Clients_AccountID_ClientCode added.';
    END
    ELSE
        PRINT 'Skipping UNIQUE for Clients: ClientCode column not found.';
END
GO

-- Projects: (AccountID, ProjNum)
IF OBJECT_ID(N'dbo.Projects', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Projects', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Projects') AND name = N'UQ_Projects_AccountID_ProjNum')
BEGIN
    IF COL_LENGTH(N'dbo.Projects', N'ProjNum') IS NOT NULL
    BEGIN
        DECLARE @pn NVARCHAR(256);
        SELECT TOP 1 @pn = i.name FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID(N'dbo.Projects') AND i.is_unique = 1 AND c.name = N'ProjNum'
          AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic2 INNER JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id
                           WHERE ic2.object_id = OBJECT_ID(N'dbo.Projects') AND ic2.index_id = i.index_id AND c2.name = N'AccountID');
        IF @pn IS NOT NULL
            EXEC('ALTER TABLE dbo.Projects DROP CONSTRAINT ' + QUOTENAME(@pn));
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Projects_AccountID_ProjNum ON dbo.Projects (AccountID, ProjNum);
        PRINT 'UQ_Projects_AccountID_ProjNum added.';
    END
    ELSE
        PRINT 'Skipping UNIQUE for Projects: ProjNum column not found.';
END
GO

-- Manufacturers: (AccountID, ManuName)
IF OBJECT_ID(N'dbo.Manufacturers', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Manufacturers', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Manufacturers') AND name = N'UQ_Manufacturers_AccountID_ManuName')
BEGIN
    IF COL_LENGTH(N'dbo.Manufacturers', N'ManuName') IS NOT NULL
    BEGIN
        DECLARE @mn NVARCHAR(256);
        SELECT TOP 1 @mn = i.name FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID(N'dbo.Manufacturers') AND i.is_unique = 1 AND c.name = N'ManuName'
          AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic2 INNER JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id
                           WHERE ic2.object_id = OBJECT_ID(N'dbo.Manufacturers') AND ic2.index_id = i.index_id AND c2.name = N'AccountID');
        IF @mn IS NOT NULL
            EXEC('ALTER TABLE dbo.Manufacturers DROP CONSTRAINT ' + QUOTENAME(@mn));
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Manufacturers_AccountID_ManuName ON dbo.Manufacturers (AccountID, ManuName);
        PRINT 'UQ_Manufacturers_AccountID_ManuName added.';
    END
    ELSE
        PRINT 'Skipping UNIQUE for Manufacturers: ManuName column not found.';
END
GO

-- Suppliers: (AccountID, SuppCode)
IF OBJECT_ID(N'dbo.Suppliers', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Suppliers', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Suppliers') AND name = N'UQ_Suppliers_AccountID_SuppCode')
BEGIN
    IF COL_LENGTH(N'dbo.Suppliers', N'SuppCode') IS NOT NULL
    BEGIN
        DECLARE @sn NVARCHAR(256);
        SELECT TOP 1 @sn = i.name FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        WHERE i.object_id = OBJECT_ID(N'dbo.Suppliers') AND i.is_unique = 1 AND c.name = N'SuppCode'
          AND NOT EXISTS (SELECT 1 FROM sys.index_columns ic2 INNER JOIN sys.columns c2 ON ic2.object_id = c2.object_id AND ic2.column_id = c2.column_id
                           WHERE ic2.object_id = OBJECT_ID(N'dbo.Suppliers') AND ic2.index_id = i.index_id AND c2.name = N'AccountID');
        IF @sn IS NOT NULL
            EXEC('ALTER TABLE dbo.Suppliers DROP CONSTRAINT ' + QUOTENAME(@sn));
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Suppliers_AccountID_SuppCode ON dbo.Suppliers (AccountID, SuppCode);
        PRINT 'UQ_Suppliers_AccountID_SuppCode added.';
    END
    ELSE
        PRINT 'Skipping UNIQUE for Suppliers: SuppCode column not found.';
END
GO

-- Areas: (AccountID, AreaCode) or (AccountID, AreaName)
IF OBJECT_ID(N'dbo.Areas', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Areas', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Areas') AND name IN (N'UQ_Areas_AccountID_AreaCode', N'UQ_Areas_AccountID_AreaName'))
BEGIN
    IF COL_LENGTH(N'dbo.Areas', N'AreaCode') IS NOT NULL
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Areas_AccountID_AreaCode ON dbo.Areas (AccountID, AreaCode);
        PRINT 'UQ_Areas_AccountID_AreaCode added.';
    END
    ELSE IF COL_LENGTH(N'dbo.Areas', N'AreaName') IS NOT NULL
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Areas_AccountID_AreaName ON dbo.Areas (AccountID, AreaName);
        PRINT 'UQ_Areas_AccountID_AreaName added.';
    END
    ELSE
        PRINT 'Skipping UNIQUE for Areas: no AreaCode/AreaName column found.';
END
GO

-- Warehouses: (AccountID, WarehouseName)
IF OBJECT_ID(N'dbo.Warehouses', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.Warehouses', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Warehouses') AND name = N'UQ_Warehouses_AccountID_WarehouseName')
BEGIN
    IF COL_LENGTH(N'dbo.Warehouses', N'WarehouseName') IS NOT NULL
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UQ_Warehouses_AccountID_WarehouseName ON dbo.Warehouses (AccountID, WarehouseName);
        PRINT 'UQ_Warehouses_AccountID_WarehouseName added.';
    END
    ELSE
        PRINT 'Skipping UNIQUE for Warehouses: WarehouseName column not found.';
END
GO

-- =============================================================================
-- 3. Non-unique indexes for AccountID-filtered query paths
-- =============================================================================

IF COL_LENGTH(N'dbo.Sheets', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Sheets') AND name = N'IX_Sheets_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Sheets_AccountID ON dbo.Sheets (AccountID);
    PRINT 'IX_Sheets_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Sheets', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Sheets') AND name = N'IX_Sheets_AccountID_Status')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Sheets_AccountID_Status ON dbo.Sheets (AccountID, Status);
    PRINT 'IX_Sheets_AccountID_Status added.';
END
GO

IF COL_LENGTH(N'dbo.ExportJobs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.ExportJobs') AND name = N'IX_ExportJobs_AccountID_CreatedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_ExportJobs_AccountID_CreatedAt ON dbo.ExportJobs (AccountID, CreatedAt DESC);
    PRINT 'IX_ExportJobs_AccountID_CreatedAt added.';
END
GO

IF COL_LENGTH(N'dbo.AuditLogs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.AuditLogs') AND name = N'IX_AuditLogs_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_AccountID ON dbo.AuditLogs (AccountID);
    PRINT 'IX_AuditLogs_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.AuditLogs', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.AuditLogs') AND name = N'IX_AuditLogs_AccountID_PerformedAt')
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_AccountID_PerformedAt ON dbo.AuditLogs (AccountID, PerformedAt DESC);
    PRINT 'IX_AuditLogs_AccountID_PerformedAt added.';
END
GO

IF COL_LENGTH(N'dbo.Clients', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Clients') AND name = N'IX_Clients_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Clients_AccountID ON dbo.Clients (AccountID);
    PRINT 'IX_Clients_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Projects', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Projects') AND name = N'IX_Projects_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Projects_AccountID ON dbo.Projects (AccountID);
    PRINT 'IX_Projects_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Manufacturers', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Manufacturers') AND name = N'IX_Manufacturers_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Manufacturers_AccountID ON dbo.Manufacturers (AccountID);
    PRINT 'IX_Manufacturers_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Suppliers', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Suppliers') AND name = N'IX_Suppliers_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Suppliers_AccountID ON dbo.Suppliers (AccountID);
    PRINT 'IX_Suppliers_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Areas', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Areas') AND name = N'IX_Areas_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Areas_AccountID ON dbo.Areas (AccountID);
    PRINT 'IX_Areas_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Warehouses', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Warehouses') AND name = N'IX_Warehouses_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Warehouses_AccountID ON dbo.Warehouses (AccountID);
    PRINT 'IX_Warehouses_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Estimations', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Estimations') AND name = N'IX_Estimations_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Estimations_AccountID ON dbo.Estimations (AccountID);
    PRINT 'IX_Estimations_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.InventoryItems', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InventoryItems') AND name = N'IX_InventoryItems_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_InventoryItems_AccountID ON dbo.InventoryItems (AccountID);
    PRINT 'IX_InventoryItems_AccountID added.';
END
GO

IF COL_LENGTH(N'dbo.Notifications', N'AccountID') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Notifications') AND name = N'IX_Notifications_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Notifications_AccountID ON dbo.Notifications (AccountID);
    PRINT 'IX_Notifications_AccountID added.';
END
GO

PRINT 'Phase 2.5 Bundle 2 constraints and indexes: done.';
GO

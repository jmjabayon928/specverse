-- Phase 2.5 Bundle 2: Add AccountID column (nullable) to all tenant-owned tables
-- Contracts: docs/phase2.5-tenant-model-and-table-scope.md, docs/phase2.5-implementation-plan.md
-- Scope: Add AccountID INT NULL only. Backfill and NOT NULL are in separate migrations.
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.
-- Prerequisite: Bundle 1 (Accounts, AccountMembers, default account) must be applied.

USE DataSheets;
GO

-- =============================================================================
-- Helper: Add AccountID INT NULL if table exists and column does not exist
-- =============================================================================

-- Reference / operational (account-owned first)
IF OBJECT_ID(N'dbo.Clients', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Clients', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Clients ADD AccountID INT NULL;
    PRINT 'dbo.Clients: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Projects', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Projects', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Projects ADD AccountID INT NULL;
    PRINT 'dbo.Projects: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Warehouses', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Warehouses', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Warehouses ADD AccountID INT NULL;
    PRINT 'dbo.Warehouses: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Manufacturers', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Manufacturers', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Manufacturers ADD AccountID INT NULL;
    PRINT 'dbo.Manufacturers: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Suppliers', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Suppliers', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Suppliers ADD AccountID INT NULL;
    PRINT 'dbo.Suppliers: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Areas', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Areas', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Areas ADD AccountID INT NULL;
    PRINT 'dbo.Areas: AccountID added.';
END
GO

-- Sheets and sheet-descendant tables
IF OBJECT_ID(N'dbo.Sheets', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Sheets', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Sheets ADD AccountID INT NULL;
    PRINT 'dbo.Sheets: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.SubSheets', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SubSheets', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.SubSheets ADD AccountID INT NULL;
    PRINT 'dbo.SubSheets: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InformationTemplates', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InformationTemplates', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InformationTemplates ADD AccountID INT NULL;
    PRINT 'dbo.InformationTemplates: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InformationTemplateOptions', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InformationTemplateOptions', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InformationTemplateOptions ADD AccountID INT NULL;
    PRINT 'dbo.InformationTemplateOptions: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InformationValues', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InformationValues', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InformationValues ADD AccountID INT NULL;
    PRINT 'dbo.InformationValues: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InformationValueSets', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InformationValueSets', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InformationValueSets ADD AccountID INT NULL;
    PRINT 'dbo.InformationValueSets: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.ValueSetFieldVariances', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ValueSetFieldVariances', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.ValueSetFieldVariances ADD AccountID INT NULL;
    PRINT 'dbo.ValueSetFieldVariances: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.SheetNotes', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SheetNotes', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.SheetNotes ADD AccountID INT NULL;
    PRINT 'dbo.SheetNotes: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Attachments', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Attachments', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Attachments ADD AccountID INT NULL;
    PRINT 'dbo.Attachments: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.SheetAttachments', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SheetAttachments', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.SheetAttachments ADD AccountID INT NULL;
    PRINT 'dbo.SheetAttachments: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.DatasheetLayouts', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.DatasheetLayouts', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.DatasheetLayouts ADD AccountID INT NULL;
    PRINT 'dbo.DatasheetLayouts: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.LayoutRegions', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.LayoutRegions', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.LayoutRegions ADD AccountID INT NULL;
    PRINT 'dbo.LayoutRegions: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.LayoutBlocks', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.LayoutBlocks', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.LayoutBlocks ADD AccountID INT NULL;
    PRINT 'dbo.LayoutBlocks: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.LayoutSubsheetSlots', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.LayoutSubsheetSlots', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.LayoutSubsheetSlots ADD AccountID INT NULL;
    PRINT 'dbo.LayoutSubsheetSlots: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.LayoutBodySlots', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.LayoutBodySlots', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.LayoutBodySlots ADD AccountID INT NULL;
    PRINT 'dbo.LayoutBodySlots: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.SheetHeaderKV', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SheetHeaderKV', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.SheetHeaderKV ADD AccountID INT NULL;
    PRINT 'dbo.SheetHeaderKV: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InfoTemplateGrouping', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InfoTemplateGrouping', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InfoTemplateGrouping ADD AccountID INT NULL;
    PRINT 'dbo.InfoTemplateGrouping: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.SheetRevisions', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.SheetRevisions', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.SheetRevisions ADD AccountID INT NULL;
    PRINT 'dbo.SheetRevisions: AccountID added.';
END
GO

-- Export, audit, change logs, notifications
IF OBJECT_ID(N'dbo.ExportJobs', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ExportJobs', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.ExportJobs ADD AccountID INT NULL;
    PRINT 'dbo.ExportJobs: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.AuditLogs', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.AuditLogs ADD AccountID INT NULL;
    PRINT 'dbo.AuditLogs: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.ChangeLogs', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.ChangeLogs', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.ChangeLogs ADD AccountID INT NULL;
    PRINT 'dbo.ChangeLogs: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Notifications', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Notifications', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Notifications ADD AccountID INT NULL;
    PRINT 'dbo.Notifications: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.NotificationRecipients', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.NotificationRecipients', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.NotificationRecipients ADD AccountID INT NULL;
    PRINT 'dbo.NotificationRecipients: AccountID added.';
END
GO

-- Inventory
IF OBJECT_ID(N'dbo.InventoryItems', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InventoryItems', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryItems ADD AccountID INT NULL;
    PRINT 'dbo.InventoryItems: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.Inventory', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Inventory', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Inventory ADD AccountID INT NULL;
    PRINT 'dbo.Inventory: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InventoryTransactions', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InventoryTransactions', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryTransactions ADD AccountID INT NULL;
    PRINT 'dbo.InventoryTransactions: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InventoryMaintenanceLogs', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InventoryMaintenanceLogs', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryMaintenanceLogs ADD AccountID INT NULL;
    PRINT 'dbo.InventoryMaintenanceLogs: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.InventoryAuditLogs', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.InventoryAuditLogs', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryAuditLogs ADD AccountID INT NULL;
    PRINT 'dbo.InventoryAuditLogs: AccountID added.';
END
GO

-- Estimation
IF OBJECT_ID(N'dbo.Estimations', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Estimations', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Estimations ADD AccountID INT NULL;
    PRINT 'dbo.Estimations: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.EstimationPackages', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EstimationPackages', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.EstimationPackages ADD AccountID INT NULL;
    PRINT 'dbo.EstimationPackages: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.EstimationItems', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EstimationItems', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.EstimationItems ADD AccountID INT NULL;
    PRINT 'dbo.EstimationItems: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.EstimationItemSupplierQuotes', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EstimationItemSupplierQuotes', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.EstimationItemSupplierQuotes ADD AccountID INT NULL;
    PRINT 'dbo.EstimationItemSupplierQuotes: AccountID added.';
END
GO

-- Parties, MirrorTemplates (if present)
IF OBJECT_ID(N'dbo.Parties', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.Parties', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.Parties ADD AccountID INT NULL;
    PRINT 'dbo.Parties: AccountID added.';
END
GO

IF OBJECT_ID(N'dbo.MirrorTemplates', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.MirrorTemplates', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.MirrorTemplates ADD AccountID INT NULL;
    PRINT 'dbo.MirrorTemplates: AccountID added.';
END
GO

-- EstimationSuppliers (referenced in estimation controller delete)
IF OBJECT_ID(N'dbo.EstimationSuppliers', N'U') IS NOT NULL AND COL_LENGTH(N'dbo.EstimationSuppliers', N'AccountID') IS NULL
BEGIN
    ALTER TABLE dbo.EstimationSuppliers ADD AccountID INT NULL;
    PRINT 'dbo.EstimationSuppliers: AccountID added.';
END
GO

PRINT 'Phase 2.5 Bundle 2 add AccountID columns: done.';
GO

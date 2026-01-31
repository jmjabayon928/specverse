-- Migration: Phase 2 Value Contexts and InformationValueSets
-- Purpose: ValueContexts lookup, InformationValueSets, InformationValues.ValueSetID + UOM,
--          ValueSetFieldVariances, seed ValueContexts. UOM column + backfill.
-- Safe to re-run: IF NOT EXISTS / IF EXISTS / COL_LENGTH patterns.

-- =============================================================================
-- 1. ValueContexts (lookup)
-- =============================================================================
IF OBJECT_ID(N'dbo.ValueContexts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValueContexts (
        ContextID   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Code        NVARCHAR(30)  NOT NULL,
        Name        NVARCHAR(100) NOT NULL,
        SortOrder   INT           NOT NULL,
        CreatedAt   DATETIME2     NOT NULL DEFAULT GETDATE(),
        UpdatedAt   DATETIME2     NULL,
        CONSTRAINT UQ_ValueContexts_Code UNIQUE (Code)
    );
    PRINT 'ValueContexts table created.';
END
ELSE
BEGIN
    IF COL_LENGTH(N'dbo.ValueContexts', N'CreatedAt') IS NULL
        ALTER TABLE dbo.ValueContexts ADD CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE();
    IF COL_LENGTH(N'dbo.ValueContexts', N'UpdatedAt') IS NULL
        ALTER TABLE dbo.ValueContexts ADD UpdatedAt DATETIME2 NULL;
    PRINT 'ValueContexts table already exists.';
END
GO

-- Seed ValueContexts (exact: Code, Name, SortOrder)
IF NOT EXISTS (SELECT 1 FROM dbo.ValueContexts WHERE Code = N'Requirement')
    INSERT INTO dbo.ValueContexts (Code, Name, SortOrder) VALUES (N'Requirement', N'Purchaser Requirement', 1);
IF NOT EXISTS (SELECT 1 FROM dbo.ValueContexts WHERE Code = N'Offered')
    INSERT INTO dbo.ValueContexts (Code, Name, SortOrder) VALUES (N'Offered', N'Vendor Offered', 2);
IF NOT EXISTS (SELECT 1 FROM dbo.ValueContexts WHERE Code = N'AsBuilt')
    INSERT INTO dbo.ValueContexts (Code, Name, SortOrder) VALUES (N'AsBuilt', N'As-Built / Verified', 3);
GO

-- =============================================================================
-- 2. InformationValueSets
-- =============================================================================
IF OBJECT_ID(N'dbo.InformationValueSets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InformationValueSets (
        ValueSetID  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SheetID     INT               NOT NULL,
        ContextID   INT               NOT NULL,
        PartyID     INT               NULL,
        Status      VARCHAR(30)       NOT NULL DEFAULT 'Draft',
        CreatedAt   DATETIME2         NOT NULL DEFAULT GETDATE(),
        CreatedBy   INT               NULL,
        UpdatedAt   DATETIME2         NULL,
        UpdatedBy   INT               NULL,
        CONSTRAINT FK_InformationValueSets_SheetID   FOREIGN KEY (SheetID)   REFERENCES dbo.Sheets(SheetID) ON DELETE CASCADE,
        CONSTRAINT FK_InformationValueSets_ContextID FOREIGN KEY (ContextID)   REFERENCES dbo.ValueContexts(ContextID),
        CONSTRAINT CK_InformationValueSets_Status   CHECK (Status IN ('Draft', 'Locked', 'Verified'))
    );
    -- Filtered unique: (SheetID, ContextID, PartyID) WHERE PartyID IS NOT NULL
    CREATE UNIQUE NONCLUSTERED INDEX UQ_InformationValueSets_SheetID_ContextID_PartyID
        ON dbo.InformationValueSets (SheetID, ContextID, PartyID)
        WHERE PartyID IS NOT NULL;
    -- Filtered unique: (SheetID, ContextID) WHERE PartyID IS NULL
    CREATE UNIQUE NONCLUSTERED INDEX UQ_InformationValueSets_SheetID_ContextID_NullParty
        ON dbo.InformationValueSets (SheetID, ContextID)
        WHERE PartyID IS NULL;
    CREATE INDEX IX_InformationValueSets_SheetID ON dbo.InformationValueSets(SheetID);
    PRINT 'InformationValueSets table created.';
END
ELSE
BEGIN
    PRINT 'InformationValueSets table already exists.';
    -- Ensure filtered unique indexes exist (e.g. after older migration that created table without them)
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InformationValueSets') AND name = N'UQ_InformationValueSets_SheetID_ContextID_PartyID')
        CREATE UNIQUE NONCLUSTERED INDEX UQ_InformationValueSets_SheetID_ContextID_PartyID
            ON dbo.InformationValueSets (SheetID, ContextID, PartyID) WHERE PartyID IS NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InformationValueSets') AND name = N'UQ_InformationValueSets_SheetID_ContextID_NullParty')
        CREATE UNIQUE NONCLUSTERED INDEX UQ_InformationValueSets_SheetID_ContextID_NullParty
            ON dbo.InformationValueSets (SheetID, ContextID) WHERE PartyID IS NULL;
END
GO

-- Party FK stays commented in this forward migration (use phase2_add_parties_fk.sql when Parties exists)
-- IF OBJECT_ID(N'dbo.Parties', N'U') IS NOT NULL ...
--     ALTER TABLE dbo.InformationValueSets ADD CONSTRAINT FK_InformationValueSets_PartyID ...

-- =============================================================================
-- 3. InformationValues: add ValueSetID
-- =============================================================================
IF COL_LENGTH(N'dbo.InformationValues', N'ValueSetID') IS NULL
BEGIN
    ALTER TABLE dbo.InformationValues ADD ValueSetID INT NULL;
    PRINT 'InformationValues.ValueSetID column added.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InformationValues') AND name = 'FK_InformationValues_ValueSetID')
BEGIN
    ALTER TABLE dbo.InformationValues
        ADD CONSTRAINT FK_InformationValues_ValueSetID FOREIGN KEY (ValueSetID) REFERENCES dbo.InformationValueSets(ValueSetID);
    PRINT 'FK_InformationValues_ValueSetID added.';
END
GO

-- Filtered unique indexes on InformationValues (create only after ValueSetID exists to avoid running
-- before column/FK are in place; use sys.indexes by object_id+name for idempotency; names match DB convention).
IF COL_LENGTH(N'dbo.InformationValues', N'ValueSetID') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InformationValues') AND name = N'UX_InfoValues_ValueSet_InfoTemplate')
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UX_InfoValues_ValueSet_InfoTemplate
            ON dbo.InformationValues (ValueSetID, InfoTemplateID)
            WHERE ValueSetID IS NOT NULL;
        PRINT 'UX_InfoValues_ValueSet_InfoTemplate created.';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InformationValues') AND name = N'UX_InfoValues_Sheet_InfoTemplate_Legacy')
    BEGIN
        CREATE UNIQUE NONCLUSTERED INDEX UX_InfoValues_Sheet_InfoTemplate_Legacy
            ON dbo.InformationValues (SheetID, InfoTemplateID)
            WHERE ValueSetID IS NULL;
        PRINT 'UX_InfoValues_Sheet_InfoTemplate_Legacy created.';
    END
END
GO

-- =============================================================================
-- 4. UOM hardening: ensure UOM column exists and backfill from template
-- =============================================================================
IF COL_LENGTH(N'dbo.InformationValues', N'UOM') IS NULL
BEGIN
    ALTER TABLE dbo.InformationValues ADD UOM NVARCHAR(50) NULL;
    PRINT 'InformationValues.UOM column added.';
END
GO

-- Backfill UOM for existing rows where UOM IS NULL (from InformationTemplates by InfoTemplateID)
UPDATE iv
SET iv.UOM = it.UOM
FROM dbo.InformationValues iv
INNER JOIN dbo.InformationTemplates it ON it.InfoTemplateID = iv.InfoTemplateID
WHERE iv.UOM IS NULL;
IF @@ROWCOUNT > 0
    PRINT 'InformationValues.UOM backfilled from InformationTemplates.';
GO

-- =============================================================================
-- 5. ValueSetFieldVariances
-- =============================================================================
IF OBJECT_ID(N'dbo.ValueSetFieldVariances', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValueSetFieldVariances (
        ValueSetID     INT           NOT NULL,
        InfoTemplateID INT           NOT NULL,
        VarianceStatus VARCHAR(30)   NOT NULL,
        ReviewedBy     INT           NULL,
        ReviewedAt     DATETIME2     NULL,
        CONSTRAINT PK_ValueSetFieldVariances PRIMARY KEY (ValueSetID, InfoTemplateID),
        CONSTRAINT FK_ValueSetFieldVariances_ValueSetID      FOREIGN KEY (ValueSetID)      REFERENCES dbo.InformationValueSets(ValueSetID) ON DELETE CASCADE,
        CONSTRAINT FK_ValueSetFieldVariances_InfoTemplateID FOREIGN KEY (InfoTemplateID)  REFERENCES dbo.InformationTemplates(InfoTemplateID),
        CONSTRAINT CK_ValueSetFieldVariances_Status         CHECK (VarianceStatus IN ('DeviatesAccepted', 'DeviatesRejected'))
    );
    PRINT 'ValueSetFieldVariances table created.';
END
ELSE
    PRINT 'ValueSetFieldVariances table already exists.';
GO

-- FK ReviewedBy -> Users(UserID) only if dbo.Users exists (same pattern as Parties)
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.ValueSetFieldVariances') AND name = 'FK_ValueSetFieldVariances_ReviewedBy')
BEGIN
    ALTER TABLE dbo.ValueSetFieldVariances
    ADD CONSTRAINT FK_ValueSetFieldVariances_ReviewedBy FOREIGN KEY (ReviewedBy) REFERENCES dbo.Users(UserID);
    PRINT 'FK_ValueSetFieldVariances_ReviewedBy added.';
END
GO

-- Rollback: Phase 2 Value Contexts and InformationValueSets
-- Run only when you need to undo phase2_value_contexts_and_valuesets.sql.
-- Order: drop constraints/indexes first, then columns/tables (reverse of forward).
-- Note: InformationValues.UOM column is NOT dropped (may have existed or been backfilled; leave in place).

-- =============================================================================
-- 1. ValueSetFieldVariances
-- =============================================================================
IF OBJECT_ID(N'dbo.ValueSetFieldVariances', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.ValueSetFieldVariances;
    PRINT 'ValueSetFieldVariances dropped.';
END
GO

-- =============================================================================
-- 2. InformationValues: drop indexes and FK, then column
-- =============================================================================
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InformationValues') AND name = N'UX_InfoValues_ValueSet_InfoTemplate')
BEGIN
    DROP INDEX UX_InfoValues_ValueSet_InfoTemplate ON dbo.InformationValues;
    PRINT 'UX_InfoValues_ValueSet_InfoTemplate dropped.';
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InformationValues') AND name = N'UX_InfoValues_Sheet_InfoTemplate_Legacy')
BEGIN
    DROP INDEX UX_InfoValues_Sheet_InfoTemplate_Legacy ON dbo.InformationValues;
    PRINT 'UX_InfoValues_Sheet_InfoTemplate_Legacy dropped.';
END
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.InformationValues') AND name = 'FK_InformationValues_ValueSetID')
BEGIN
    ALTER TABLE dbo.InformationValues DROP CONSTRAINT FK_InformationValues_ValueSetID;
    PRINT 'FK_InformationValues_ValueSetID dropped.';
END
GO

IF COL_LENGTH(N'dbo.InformationValues', N'ValueSetID') IS NOT NULL
BEGIN
    ALTER TABLE dbo.InformationValues DROP COLUMN ValueSetID;
    PRINT 'InformationValues.ValueSetID dropped.';
END
GO

-- =============================================================================
-- 3. InformationValueSets
-- =============================================================================
IF OBJECT_ID(N'dbo.InformationValueSets', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.InformationValueSets;
    PRINT 'InformationValueSets dropped.';
END
GO

-- =============================================================================
-- 4. ValueContexts (seed rows are deleted with table)
-- =============================================================================
IF OBJECT_ID(N'dbo.ValueContexts', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.ValueContexts;
    PRINT 'ValueContexts dropped.';
END
GO

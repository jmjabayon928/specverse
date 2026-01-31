-- Follow-up migration: Add FK from InformationValueSets.PartyID to dbo.Parties(PartyID).
-- Run ONLY when dbo.Parties exists and is populated.
-- Run AFTER phase2_value_contexts_and_valuesets.sql.

-- =============================================================================
-- 1. Orphan check: fail if any InformationValueSets.PartyID is not in Parties
-- =============================================================================
IF OBJECT_ID(N'dbo.Parties', N'U') IS NULL
BEGIN
    PRINT 'dbo.Parties does not exist. Skip this migration or create Parties first.';
    RETURN;
END

IF EXISTS (
    SELECT 1
    FROM dbo.InformationValueSets ivs
    LEFT JOIN dbo.Parties p ON p.PartyID = ivs.PartyID
    WHERE ivs.PartyID IS NOT NULL
      AND p.PartyID IS NULL
)
BEGIN
    RAISERROR('Orphan PartyID found in InformationValueSets. Resolve or delete those rows before adding FK.', 16, 1);
    RETURN;
END

-- =============================================================================
-- 2. Add FK if not already present
-- =============================================================================
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.InformationValueSets')
      AND name = 'FK_InformationValueSets_PartyID'
)
BEGIN
    ALTER TABLE dbo.InformationValueSets
    ADD CONSTRAINT FK_InformationValueSets_PartyID
    FOREIGN KEY (PartyID) REFERENCES dbo.Parties(PartyID);
    PRINT 'FK_InformationValueSets_PartyID added.';
END
ELSE
    PRINT 'FK_InformationValueSets_PartyID already exists.';
GO

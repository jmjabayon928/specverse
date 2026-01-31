-- Backfill: Create Requirement InformationValueSets for existing filled sheets and set ValueSetID on InformationValues.
-- Run AFTER phase2_value_contexts_and_valuesets.sql and only when InformationValues has rows with ValueSetID IS NULL.
-- Safe to re-run: only creates ValueSets and updates rows where ValueSetID IS NULL.

-- Prerequisite: ValueContexts must have Code = 'Requirement' (ContextID used below).
-- USE DataSheets;
-- GO

DECLARE @RequirementContextID INT;
SELECT @RequirementContextID = ContextID FROM dbo.ValueContexts WHERE Code = N'Requirement';
IF @RequirementContextID IS NULL
BEGIN
    RAISERROR('ValueContexts.Requirement not found. Run phase2_value_contexts_and_valuesets.sql first.', 16, 1);
    RETURN;
END

-- For each distinct SheetID that has InformationValues with ValueSetID NULL (filled sheets only; skip templates IsTemplate = 0),
-- ensure one Requirement ValueSet and set ValueSetID on those rows.
DECLARE @SheetID INT;
DECLARE @ValueSetID INT;
DECLARE @CreatedBy INT = NULL; -- optional: set to a system user if you track CreatedBy

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT DISTINCT iv.SheetID
    FROM dbo.InformationValues iv
    WHERE iv.ValueSetID IS NULL
      AND EXISTS (SELECT 1 FROM dbo.Sheets s WHERE s.SheetID = iv.SheetID AND s.IsTemplate = 0);

OPEN cur;
FETCH NEXT FROM cur INTO @SheetID;
WHILE @@FETCH_STATUS = 0
BEGIN
    -- Get or create Requirement ValueSet for this sheet
    SELECT @ValueSetID = ValueSetID
    FROM dbo.InformationValueSets
    WHERE SheetID = @SheetID AND ContextID = @RequirementContextID AND PartyID IS NULL;

    IF @ValueSetID IS NULL
    BEGIN
        INSERT INTO dbo.InformationValueSets (SheetID, ContextID, PartyID, Status, CreatedAt, CreatedBy)
        VALUES (@SheetID, @RequirementContextID, NULL, 'Draft', GETDATE(), @CreatedBy);
        SET @ValueSetID = SCOPE_IDENTITY();
    END

    UPDATE dbo.InformationValues
    SET ValueSetID = @ValueSetID
    WHERE SheetID = @SheetID AND ValueSetID IS NULL;

    FETCH NEXT FROM cur INTO @SheetID;
END;
CLOSE cur;
DEALLOCATE cur;

PRINT 'Backfill Requirement ValueSets completed.';

-- =============================================================================
-- SQL Server: Composite FK enforcement for Schedules Facility/Space/System
-- Tables: Schedules, Facilities, FacilitySpaces, FacilitySystems
-- Run sections independently or use "Section 5: Safe execution wrapper" at end.
-- =============================================================================

-- =============================================================================
-- SECTION 1: PRE-VALIDATION QUERIES (run before adding constraints)
-- Run these first. If any return rows, fix data before running Section 2/3.
-- =============================================================================

-- 1a) Schedules where (AccountID, FacilityID) does not exist in Facilities
--     (only rows with non-NULL FacilityID)
SELECT s.ScheduleID, s.AccountID, s.FacilityID
FROM dbo.Schedules s
WHERE s.FacilityID IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.Facilities f
    WHERE f.AccountID = s.AccountID AND f.FacilityID = s.FacilityID
  );

-- 1b) Schedules where (AccountID, SpaceID) does not exist in FacilitySpaces
--     (only rows with non-NULL SpaceID)
SELECT s.ScheduleID, s.AccountID, s.SpaceID
FROM dbo.Schedules s
WHERE s.SpaceID IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.FacilitySpaces fs
    WHERE fs.AccountID = s.AccountID AND fs.SpaceID = s.SpaceID
  );

-- 1c) Schedules where (AccountID, SystemID) does not exist in FacilitySystems
--     (only rows with non-NULL SystemID)
SELECT s.ScheduleID, s.AccountID, s.SystemID
FROM dbo.Schedules s
WHERE s.SystemID IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.FacilitySystems fy
    WHERE fy.AccountID = s.AccountID AND fy.SystemID = s.SystemID
  );

-- 1d) Schedules where SpaceID is set but Space's FacilityID != Schedule's FacilityID
SELECT s.ScheduleID, s.AccountID, s.FacilityID AS ScheduleFacilityID, s.SpaceID,
       fs.FacilityID AS SpaceFacilityID
FROM dbo.Schedules s
INNER JOIN dbo.FacilitySpaces fs ON fs.AccountID = s.AccountID AND fs.SpaceID = s.SpaceID
WHERE s.SpaceID IS NOT NULL
  AND (s.FacilityID IS NULL OR s.FacilityID <> fs.FacilityID);

-- 1e) Schedules where SystemID is set but System's FacilityID != Schedule's FacilityID
SELECT s.ScheduleID, s.AccountID, s.FacilityID AS ScheduleFacilityID, s.SystemID,
       fy.FacilityID AS SystemFacilityID
FROM dbo.Schedules s
INNER JOIN dbo.FacilitySystems fy ON fy.AccountID = s.AccountID AND fy.SystemID = s.SystemID
WHERE s.SystemID IS NOT NULL
  AND (s.FacilityID IS NULL OR s.FacilityID <> fy.FacilityID);


-- =============================================================================
-- SECTION 2: IDEMPOTENT UNIQUE INDEX CREATION
-- Creates indexes only if they do not already exist.
-- =============================================================================

-- 2a) UQ_Facilities_AccountID_FacilityID
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.Facilities')
    AND i.name = N'UQ_Facilities_AccountID_FacilityID'
    AND i.is_unique = 1
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX [UQ_Facilities_AccountID_FacilityID]
  ON dbo.Facilities (AccountID, FacilityID)
  WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF,
        IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF,
        ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY];
END
GO

-- 2b) UQ_FacilitySpaces_AccountID_SpaceID
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.FacilitySpaces')
    AND i.name = N'UQ_FacilitySpaces_AccountID_SpaceID'
    AND i.is_unique = 1
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX [UQ_FacilitySpaces_AccountID_SpaceID]
  ON dbo.FacilitySpaces (AccountID, SpaceID)
  WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF,
        IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF,
        ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY];
END
GO

-- 2c) UQ_FacilitySystems_AccountID_SystemID
IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.FacilitySystems')
    AND i.name = N'UQ_FacilitySystems_AccountID_SystemID'
    AND i.is_unique = 1
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX [UQ_FacilitySystems_AccountID_SystemID]
  ON dbo.FacilitySystems (AccountID, SystemID)
  WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF,
        IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF,
        ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY];
END
GO


-- =============================================================================
-- SECTION 3: IDEMPOTENT COMPOSITE FOREIGN KEY CREATION
-- Creates FKs only if they do not already exist. NULLs in child columns are allowed.
-- =============================================================================

-- 3a) FK_Schedules_Facility: (AccountID, FacilityID) -> Facilities(AccountID, FacilityID)
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules')
    AND name = N'FK_Schedules_Facility'
)
BEGIN
  ALTER TABLE dbo.Schedules
  ADD CONSTRAINT [FK_Schedules_Facility]
  FOREIGN KEY (AccountID, FacilityID)
  REFERENCES dbo.Facilities (AccountID, FacilityID);
END
GO

-- 3b) FK_Schedules_Space: (AccountID, SpaceID) -> FacilitySpaces(AccountID, SpaceID)
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules')
    AND name = N'FK_Schedules_Space'
)
BEGIN
  ALTER TABLE dbo.Schedules
  ADD CONSTRAINT [FK_Schedules_Space]
  FOREIGN KEY (AccountID, SpaceID)
  REFERENCES dbo.FacilitySpaces (AccountID, SpaceID);
END
GO

-- 3c) FK_Schedules_System: (AccountID, SystemID) -> FacilitySystems(AccountID, SystemID)
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules')
    AND name = N'FK_Schedules_System'
)
BEGIN
  ALTER TABLE dbo.Schedules
  ADD CONSTRAINT [FK_Schedules_System]
  FOREIGN KEY (AccountID, SystemID)
  REFERENCES dbo.FacilitySystems (AccountID, SystemID);
END
GO


-- =============================================================================
-- SECTION 4: ROLLBACK SCRIPT (drops FKs then indexes; use IF EXISTS)
-- =============================================================================

-- 4a) Drop foreign keys
IF EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules') AND name = N'FK_Schedules_System'
)
  ALTER TABLE dbo.Schedules DROP CONSTRAINT [FK_Schedules_System];
GO

IF EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules') AND name = N'FK_Schedules_Space'
)
  ALTER TABLE dbo.Schedules DROP CONSTRAINT [FK_Schedules_Space];
GO

IF EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules') AND name = N'FK_Schedules_Facility'
)
  ALTER TABLE dbo.Schedules DROP CONSTRAINT [FK_Schedules_Facility];
GO

-- 4b) Drop unique indexes
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.FacilitySystems') AND name = N'UQ_FacilitySystems_AccountID_SystemID'
)
  DROP INDEX [UQ_FacilitySystems_AccountID_SystemID] ON dbo.FacilitySystems;
GO

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.FacilitySpaces') AND name = N'UQ_FacilitySpaces_AccountID_SpaceID'
)
  DROP INDEX [UQ_FacilitySpaces_AccountID_SpaceID] ON dbo.FacilitySpaces;
GO

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Facilities') AND name = N'UQ_Facilities_AccountID_FacilityID'
)
  DROP INDEX [UQ_Facilities_AccountID_FacilityID] ON dbo.Facilities;
GO


-- =============================================================================
-- SECTION 5: SAFE EXECUTION WRAPPER (Section 2 + 3 in one transaction)
-- Run Section 1 first; only run this if all validation queries return no rows.
-- =============================================================================
/*
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;

  -- Unique indexes
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Facilities') AND name = N'UQ_Facilities_AccountID_FacilityID')
  BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_Facilities_AccountID_FacilityID]
    ON dbo.Facilities (AccountID, FacilityID)
    WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF,
          IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF,
          ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY];
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.FacilitySpaces') AND name = N'UQ_FacilitySpaces_AccountID_SpaceID')
  BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_FacilitySpaces_AccountID_SpaceID]
    ON dbo.FacilitySpaces (AccountID, SpaceID)
    WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF,
          IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF,
          ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY];
  END

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.FacilitySystems') AND name = N'UQ_FacilitySystems_AccountID_SystemID')
  BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UQ_FacilitySystems_AccountID_SystemID]
    ON dbo.FacilitySystems (AccountID, SystemID)
    WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF,
          IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF,
          ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY];
  END

  -- Foreign keys
  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules') AND name = N'FK_Schedules_Facility')
    ALTER TABLE dbo.Schedules ADD CONSTRAINT [FK_Schedules_Facility]
    FOREIGN KEY (AccountID, FacilityID) REFERENCES dbo.Facilities (AccountID, FacilityID);

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules') AND name = N'FK_Schedules_Space')
    ALTER TABLE dbo.Schedules ADD CONSTRAINT [FK_Schedules_Space]
    FOREIGN KEY (AccountID, SpaceID) REFERENCES dbo.FacilitySpaces (AccountID, SpaceID);

  IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.Schedules') AND name = N'FK_Schedules_System')
    ALTER TABLE dbo.Schedules ADD CONSTRAINT [FK_Schedules_System]
    FOREIGN KEY (AccountID, SystemID) REFERENCES dbo.FacilitySystems (AccountID, SystemID);

  COMMIT TRANSACTION;
  PRINT 'Composite FK enforcement applied successfully.';
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  DECLARE @msg NVARCHAR(4000) = ERROR_MESSAGE();
  RAISERROR(N'Error applying constraints: %s', 16, 1, @msg);
END CATCH
*/

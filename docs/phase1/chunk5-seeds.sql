-- Phase 1 Chunk 5: Seed Disciplines and DatasheetSubtypes (manual run only; do NOT auto-run on app startup).
-- Run this script against your SpecVerse database before running the instrumentation template seed script.
-- Prerequisites: Disciplines and DatasheetSubtypes tables exist (see docs/phase1/verify-discipline-schema.sql).

-- =============================================================================
-- 1) Disciplines: PIPING, INSTRUMENTATION (optional: ELECTRICAL)
-- =============================================================================
-- Assumes dbo.Disciplines has at least: DisciplineID (identity), DisciplineName

IF NOT EXISTS (SELECT 1 FROM dbo.Disciplines WHERE DisciplineName = N'PIPING')
  INSERT INTO dbo.Disciplines (DisciplineName) VALUES (N'PIPING');

IF NOT EXISTS (SELECT 1 FROM dbo.Disciplines WHERE DisciplineName = N'INSTRUMENTATION')
  INSERT INTO dbo.Disciplines (DisciplineName) VALUES (N'INSTRUMENTATION');

-- Optional third discipline
-- IF NOT EXISTS (SELECT 1 FROM dbo.Disciplines WHERE DisciplineName = N'ELECTRICAL')
--   INSERT INTO dbo.Disciplines (DisciplineName) VALUES (N'ELECTRICAL');

-- =============================================================================
-- 2) DatasheetSubtypes: PRESSURE_TRANSMITTER under INSTRUMENTATION (optional: TEMPERATURE_TRANSMITTER)
-- =============================================================================
-- Assumes dbo.DatasheetSubtypes has: DatasheetSubtypeID (identity), DisciplineID, SubtypeName

DECLARE @DisciplineIdInstrumentation INT = (SELECT DisciplineID FROM dbo.Disciplines WHERE DisciplineName = N'INSTRUMENTATION');

IF @DisciplineIdInstrumentation IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.DatasheetSubtypes WHERE DisciplineID = @DisciplineIdInstrumentation AND SubtypeName = N'PRESSURE_TRANSMITTER')
  INSERT INTO dbo.DatasheetSubtypes (DisciplineID, SubtypeName) VALUES (@DisciplineIdInstrumentation, N'PRESSURE_TRANSMITTER');

-- Optional second subtype for Instrumentation
-- IF @DisciplineIdInstrumentation IS NOT NULL
--   AND NOT EXISTS (SELECT 1 FROM dbo.DatasheetSubtypes WHERE DisciplineID = @DisciplineIdInstrumentation AND SubtypeName = N'TEMPERATURE_TRANSMITTER')
--   INSERT INTO dbo.DatasheetSubtypes (DisciplineID, SubtypeName) VALUES (@DisciplineIdInstrumentation, N'TEMPERATURE_TRANSMITTER');

-- =============================================================================
-- 3) Optional backfill: Set DisciplineID = PIPING where NULL on existing Sheets
-- =============================================================================
-- Uncomment and run only if you want existing template/filled sheets without a discipline
-- to be assigned to PIPING. Replace @PipingDisciplineId with the actual PIPING DisciplineID.

-- DECLARE @PipingDisciplineId INT = (SELECT DisciplineID FROM dbo.Disciplines WHERE DisciplineName = N'PIPING');
-- IF @PipingDisciplineId IS NOT NULL
--   UPDATE dbo.Sheets SET DisciplineID = @PipingDisciplineId WHERE DisciplineID IS NULL;

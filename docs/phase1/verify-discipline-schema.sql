-- Phase 1 Chunk 1: Schema verification (run before implementing or deploying).
-- If any query returns no rows or fails, STOP and add the missing tables/columns.
-- Do NOT run migrations from this file; this is verification only.

-- 1) Disciplines table must exist
SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Disciplines';

-- 2) DatasheetSubtypes table must exist
SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'DatasheetSubtypes';

-- 3) Sheets must have DisciplineID and DatasheetSubtypeID columns
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Sheets'
  AND COLUMN_NAME IN ('DisciplineID', 'DatasheetSubtypeID');

-- Seed: expand Categories for general engineering (idempotent).
-- Adds new categories by CategoryCode; does NOT rename or delete existing rows (PU, ST, HT, AG, PR remain).
-- Safe to run multiple times: each insert is guarded by IF NOT EXISTS on CategoryCode.
--
-- How to run (SQL Server):
--   1. Connect to your SpecVerse database (e.g. sqlcmd, SSMS, or Azure Data Studio).
--   2. Execute this script: open the file and run, or: sqlcmd -S YourServer -d YourDatabase -i migrations/seed_categories_expansion.sql
--   3. Verify: SELECT CategoryID, CategoryCode, CategoryName FROM dbo.Categories ORDER BY CategoryName;
--
-- Manual verification checklist (after seeding):
--   - Template create: open UOM dropdown and confirm "Electrical" group and units (A, V, Hz, etc.) appear.
--   - Reference-options: GET /api/backend/templates/reference-options (or filledsheets/inventory) returns categories
--     list that includes Mechanical, Electrical, Instrumentation, Civil, Structural, HVAC, Piping.
--
-- Location: migrations/ (alongside other run-once/optional scripts; keeps all DB-related scripts in one place).

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryCode = N'MECH')
  INSERT INTO dbo.Categories (CategoryCode, CategoryName, CreatedAt, UpdatedAt)
  VALUES (N'MECH', N'Mechanical', SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryCode = N'ELEC')
  INSERT INTO dbo.Categories (CategoryCode, CategoryName, CreatedAt, UpdatedAt)
  VALUES (N'ELEC', N'Electrical', SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryCode = N'INST')
  INSERT INTO dbo.Categories (CategoryCode, CategoryName, CreatedAt, UpdatedAt)
  VALUES (N'INST', N'Instrumentation', SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryCode = N'CIVIL')
  INSERT INTO dbo.Categories (CategoryCode, CategoryName, CreatedAt, UpdatedAt)
  VALUES (N'CIVIL', N'Civil', SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryCode = N'STRUCT')
  INSERT INTO dbo.Categories (CategoryCode, CategoryName, CreatedAt, UpdatedAt)
  VALUES (N'STRUCT', N'Structural', SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryCode = N'HVAC')
  INSERT INTO dbo.Categories (CategoryCode, CategoryName, CreatedAt, UpdatedAt)
  VALUES (N'HVAC', N'HVAC', SYSUTCDATETIME(), SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryCode = N'PIPING')
  INSERT INTO dbo.Categories (CategoryCode, CategoryName, CreatedAt, UpdatedAt)
  VALUES (N'PIPING', N'Piping', SYSUTCDATETIME(), SYSUTCDATETIME());

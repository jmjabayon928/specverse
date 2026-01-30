-- Phase 1 Chunk 1: Backfill existing Sheets with default discipline (manual step; DO NOT RUN automatically).
-- Run only after Chunk 1 is deployed and Disciplines has a default row (e.g. Piping).

-- 1) Ensure default discipline exists (adjust column names to match your schema).
--    If your Disciplines table has DisciplineCode:
-- INSERT INTO dbo.Disciplines (DisciplineName, DisciplineCode)
-- SELECT N'Piping', N'Piping'
-- WHERE NOT EXISTS (SELECT 1 FROM dbo.Disciplines WHERE DisciplineCode = N'Piping');
--    If your Disciplines table has only DisciplineName:
-- INSERT INTO dbo.Disciplines (DisciplineName)
-- SELECT N'Piping'
-- WHERE NOT EXISTS (SELECT 1 FROM dbo.Disciplines WHERE DisciplineName = N'Piping');

-- 2) Backfill Sheets where DisciplineID is NULL (replace 1 with your Piping DisciplineID).
-- UPDATE dbo.Sheets
-- SET DisciplineID = 1
-- WHERE DisciplineID IS NULL;

-- Phase 2.5: Diagnostics for empty Templates/Filled Sheets lists
-- Run read-only to verify Sheets.AccountID state. Database: DataSheets (SQL Server).
-- If AccountID IS NULL on existing rows, run the backfill (see phase2.5-signoff.md).

USE DataSheets;
GO

-- 1) Count Sheets where AccountID IS NULL
SELECT N'Sheets with AccountID NULL' AS [Check], COUNT(*) AS [Count]
FROM dbo.Sheets
WHERE AccountID IS NULL;
GO

-- 2) Count Sheets by AccountID (non-NULL)
SELECT AccountID, COUNT(*) AS SheetCount
FROM dbo.Sheets
WHERE AccountID IS NOT NULL
GROUP BY AccountID
ORDER BY AccountID;
GO

-- 3) Sample: templates (IsTemplate = 1) with NULL vs non-NULL AccountID
SELECT TOP 5 SheetID, SheetName, IsTemplate, AccountID
FROM dbo.Sheets
WHERE IsTemplate = 1 AND AccountID IS NULL
ORDER BY SheetID DESC;

SELECT TOP 5 SheetID, SheetName, IsTemplate, AccountID
FROM dbo.Sheets
WHERE IsTemplate = 1 AND AccountID IS NOT NULL
ORDER BY SheetID DESC;
GO

-- 4) Sample: filled sheets (IsTemplate = 0) with NULL vs non-NULL AccountID
SELECT TOP 5 SheetID, SheetName, IsTemplate, AccountID
FROM dbo.Sheets
WHERE IsTemplate = 0 AND AccountID IS NULL
ORDER BY SheetID DESC;

SELECT TOP 5 SheetID, SheetName, IsTemplate, AccountID
FROM dbo.Sheets
WHERE IsTemplate = 0 AND AccountID IS NOT NULL
ORDER BY SheetID DESC;
GO

-- 5) Default account (used by backfill and by getAccountContextForUser when preferring default)
SELECT AccountID, AccountName, Slug, IsActive
FROM dbo.Accounts
WHERE Slug = N'default';
GO

-- 6) Next step (read-only recommendation)
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM dbo.Sheets WHERE AccountID IS NULL) > 0
    THEN N'Next step: Run backfill → migrations/phase2_5_bundle2_backfill_accountid.sql'
    ELSE N'Next step: Check AccountMembers for your user and compare to Sheets.AccountID distribution (lists show only rows for your account).'
  END AS [NextStep];
GO

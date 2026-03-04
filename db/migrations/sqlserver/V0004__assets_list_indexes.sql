-- V0004__assets_list_indexes.sql
-- Purpose: Index support for GET /api/backend/assets (MEL list + q search).
-- Flyway-safe for SQL Server: no GO, no USE, schema-qualified, idempotent guards.
-- Important: Avoids duplicate indexes if equivalent ones already exist under different names
-- (e.g., IX_Assets_Account_AssetTag, UX_Assets_Account_TagNorm).

/* ============================================================================
   1) ORDER BY + pagination support (AccountID-leading, AssetTag, AssetID)
      - Needed for: WHERE AccountID = @AccountID ... ORDER BY AssetTag, AssetID
      - Your DB already has: IX_Assets_Account_AssetTag (AccountID, AssetTag)
        so we treat that as "good enough" and DO NOT create a duplicate.
   ============================================================================ */

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.Assets')
    AND i.name IN (N'IX_Assets_AccountID_AssetTag', N'IX_Assets_Account_AssetTag')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Assets_AccountID_AssetTag
  ON dbo.Assets (AccountID, AssetTag, AssetID)
  INCLUDE (
    AssetName,
    Location,
    [System],
    Service,
    Criticality,
    DisciplineID,
    SubtypeID,
    ClientID,
    ProjectID,
    AssetTagNorm
  );
END;

/* ============================================================================
   2) q-search support on TagNorm (AccountID-leading, AssetTagNorm)
      - Needed for: WHERE AccountID=@AccountID AND AssetTagNorm LIKE @QNormPrefix
      - Your DB already has: UX_Assets_Account_TagNorm (AccountID, AssetTagNorm) UNIQUE
        so we treat that as "good enough" and DO NOT create a duplicate.
   ============================================================================ */

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes i
  WHERE i.object_id = OBJECT_ID(N'dbo.Assets')
    AND i.name IN (N'IX_Assets_AccountID_AssetTagNorm', N'UX_Assets_Account_TagNorm')
)
BEGIN
  CREATE NONCLUSTERED INDEX IX_Assets_AccountID_AssetTagNorm
  ON dbo.Assets (AccountID, AssetTagNorm)
  INCLUDE (
    AssetID,
    AssetTag,
    AssetName,
    Location,
    [System],
    Service,
    Criticality,
    DisciplineID,
    SubtypeID,
    ClientID,
    ProjectID
  );
END;
SET NOCOUNT ON
SET XACT_ABORT ON

BEGIN TRY
  BEGIN TRAN

  /* Add TemplateFieldID to RatingsEntries (if missing) */
  IF COL_LENGTH('dbo.RatingsEntries', 'TemplateFieldID') IS NULL
  BEGIN
    ALTER TABLE dbo.RatingsEntries
      ADD TemplateFieldID INT NULL
  END

  /* FK (nullable) */
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_RatingsEntries_TemplateField'
      AND parent_object_id = OBJECT_ID('dbo.RatingsEntries')
  )
  BEGIN
    ALTER TABLE dbo.RatingsEntries WITH CHECK
      ADD CONSTRAINT FK_RatingsEntries_TemplateField
        FOREIGN KEY (TemplateFieldID)
        REFERENCES dbo.RatingsBlockTemplateFields(TemplateFieldID)
  END

  /* Unique per (block, template-field) when templated */
  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_RatingsEntries_Block_TemplateField'
      AND object_id = OBJECT_ID('dbo.RatingsEntries')
  )
  BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_RatingsEntries_Block_TemplateField
      ON dbo.RatingsEntries(RatingsBlockID, TemplateFieldID)
      WHERE TemplateFieldID IS NOT NULL
  END

  /* Helpful read index */
  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_RatingsEntries_TemplateField'
      AND object_id = OBJECT_ID('dbo.RatingsEntries')
  )
  BEGIN
    CREATE NONCLUSTERED INDEX IX_RatingsEntries_TemplateField
      ON dbo.RatingsEntries(TemplateFieldID)
      WHERE TemplateFieldID IS NOT NULL
  END

  COMMIT
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK
  DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE()
  RAISERROR(@Err, 16, 1)
END CATCH

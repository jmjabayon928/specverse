SET NOCOUNT ON
SET XACT_ABORT ON

BEGIN TRY
  BEGIN TRAN

  /* RatingsBlockTemplates */
  IF OBJECT_ID('dbo.RatingsBlockTemplates', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.RatingsBlockTemplates (
      RatingsBlockTemplateID INT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_RatingsBlockTemplates PRIMARY KEY CLUSTERED,
      AccountID INT NULL,
      BlockType NVARCHAR(100) NOT NULL,
      StandardCode NVARCHAR(50) NOT NULL,
      StandardRef NVARCHAR(255) NULL,
      Description NVARCHAR(1000) NULL,
      IsActive BIT NOT NULL
        CONSTRAINT DF_RatingsBlockTemplates_IsActive DEFAULT (1),
      CreatedAt DATETIME2(7) NOT NULL
        CONSTRAINT DF_RatingsBlockTemplates_CreatedAt DEFAULT (SYSUTCDATETIME()),
      UpdatedAt DATETIME2(7) NOT NULL
        CONSTRAINT DF_RatingsBlockTemplates_UpdatedAt DEFAULT (SYSUTCDATETIME())
    )

    CREATE NONCLUSTERED INDEX IX_RatingsBlockTemplates_StandardCode
      ON dbo.RatingsBlockTemplates(StandardCode)

    CREATE NONCLUSTERED INDEX IX_RatingsBlockTemplates_BlockType
      ON dbo.RatingsBlockTemplates(BlockType)

    CREATE NONCLUSTERED INDEX IX_RatingsBlockTemplates_AccountID
      ON dbo.RatingsBlockTemplates(AccountID)
      WHERE AccountID IS NOT NULL
  END

  /* RatingsBlockTemplateFields */
  IF OBJECT_ID('dbo.RatingsBlockTemplateFields', 'U') IS NULL
  BEGIN
    CREATE TABLE dbo.RatingsBlockTemplateFields (
      TemplateFieldID INT IDENTITY(1,1) NOT NULL
        CONSTRAINT PK_RatingsBlockTemplateFields PRIMARY KEY CLUSTERED,
      RatingsBlockTemplateID INT NOT NULL,
      FieldKey NVARCHAR(240) NOT NULL,
      Label NVARCHAR(255) NOT NULL,
      DataType NVARCHAR(30) NOT NULL,  -- e.g. string/int/decimal/enum
      UOM NVARCHAR(100) NULL,
      IsRequired BIT NOT NULL
        CONSTRAINT DF_RatingsBlockTemplateFields_IsRequired DEFAULT (0),
      OrderIndex INT NOT NULL
        CONSTRAINT DF_RatingsBlockTemplateFields_OrderIndex DEFAULT (0),
      CreatedAt DATETIME2(7) NOT NULL
        CONSTRAINT DF_RatingsBlockTemplateFields_CreatedAt DEFAULT (SYSUTCDATETIME()),
      UpdatedAt DATETIME2(7) NOT NULL
        CONSTRAINT DF_RatingsBlockTemplateFields_UpdatedAt DEFAULT (SYSUTCDATETIME())
    )

    ALTER TABLE dbo.RatingsBlockTemplateFields WITH CHECK
      ADD CONSTRAINT FK_RatingsBlockTemplateFields_Template
      FOREIGN KEY (RatingsBlockTemplateID)
      REFERENCES dbo.RatingsBlockTemplates(RatingsBlockTemplateID)

    CREATE NONCLUSTERED INDEX IX_RatingsBlockTemplateFields_Template
      ON dbo.RatingsBlockTemplateFields(RatingsBlockTemplateID)

    CREATE UNIQUE NONCLUSTERED INDEX UX_RatingsBlockTemplateFields_Template_FieldKey
      ON dbo.RatingsBlockTemplateFields(RatingsBlockTemplateID, FieldKey)

    CREATE NONCLUSTERED INDEX IX_RatingsBlockTemplateFields_Template_Order
      ON dbo.RatingsBlockTemplateFields(RatingsBlockTemplateID, OrderIndex)
  END

  /* Add RatingsBlockTemplateID to RatingsBlocks (if missing) */
  IF COL_LENGTH('dbo.RatingsBlocks', 'RatingsBlockTemplateID') IS NULL
  BEGIN
    ALTER TABLE dbo.RatingsBlocks
      ADD RatingsBlockTemplateID INT NULL
  END

  /* FK from RatingsBlocks -> RatingsBlockTemplates (if missing) */
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_RatingsBlocks_Template'
      AND parent_object_id = OBJECT_ID('dbo.RatingsBlocks')
  )
  BEGIN
    ALTER TABLE dbo.RatingsBlocks WITH CHECK
      ADD CONSTRAINT FK_RatingsBlocks_Template
      FOREIGN KEY (RatingsBlockTemplateID)
      REFERENCES dbo.RatingsBlockTemplates(RatingsBlockTemplateID)
  END

  /* Helpful index */
  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_RatingsBlocks_Template'
      AND object_id = OBJECT_ID('dbo.RatingsBlocks')
  )
  BEGIN
    CREATE NONCLUSTERED INDEX IX_RatingsBlocks_Template
      ON dbo.RatingsBlocks(RatingsBlockTemplateID)
      WHERE RatingsBlockTemplateID IS NOT NULL
  END

  COMMIT
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK
  DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE()
  RAISERROR(@Err, 16, 1)
END CATCH

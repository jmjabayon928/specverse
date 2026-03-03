-- V0003: Ensure Import engine + Custom Fields tables exist, then add constraints/indexes.
-- Safe to re-run: uses existence checks throughout.

SET NOCOUNT ON
GO

/* =========================================================
   1) TABLES (create if missing)
   ========================================================= */

-- dbo.ImportJobs
IF OBJECT_ID(N'dbo.ImportJobs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ImportJobs (
    ImportJobID        INT IDENTITY(1,1) NOT NULL,
    AccountID          INT NOT NULL,
    JobStatus          NVARCHAR(40) NOT NULL,
    JobMode            NVARCHAR(40) NULL,
    SourceFileName     NVARCHAR(260) NULL,
    SourceFileSha256   CHAR(64) NULL,
    StartedByUserID    INT NULL,
    StartedAt          DATETIME2 NULL,
    CompletedAt        DATETIME2 NULL,
    TotalRows          INT NULL,
    CreatedCount       INT NOT NULL CONSTRAINT DF_ImportJobs_CreatedCount DEFAULT (0),
    UpdatedCount       INT NOT NULL CONSTRAINT DF_ImportJobs_UpdatedCount DEFAULT (0),
    SkippedCount       INT NOT NULL CONSTRAINT DF_ImportJobs_SkippedCount DEFAULT (0),
    ErrorCount         INT NOT NULL CONSTRAINT DF_ImportJobs_ErrorCount DEFAULT (0),
    ParamsJson         NVARCHAR(MAX) NULL,
    ErrorSummary       NVARCHAR(MAX) NULL,
    CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_ImportJobs_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt          DATETIME2 NOT NULL CONSTRAINT DF_ImportJobs_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_ImportJobs PRIMARY KEY CLUSTERED (ImportJobID)
  )
END
GO

-- dbo.ImportErrors
IF OBJECT_ID(N'dbo.ImportErrors', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ImportErrors (
    ImportErrorID      BIGINT IDENTITY(1,1) NOT NULL,
    AccountID          INT NOT NULL,
    ImportJobID        INT NOT NULL,
    SourceRowNumber    INT NULL,
    SourceColumnName   NVARCHAR(256) NULL,
    SourceValue        NVARCHAR(2000) NULL,
    ErrorCode          NVARCHAR(80) NULL,
    ErrorMessage       NVARCHAR(2000) NOT NULL,
    Severity           NVARCHAR(40) NULL,
    CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_ImportErrors_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_ImportErrors PRIMARY KEY CLUSTERED (ImportErrorID)
  )

  -- Optional FK (safe to add only if ImportJobs exists, which it now should)
  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_ImportErrors_ImportJobs'
      AND parent_object_id = OBJECT_ID('dbo.ImportErrors')
  )
  BEGIN
    ALTER TABLE dbo.ImportErrors
    ADD CONSTRAINT FK_ImportErrors_ImportJobs
    FOREIGN KEY (ImportJobID) REFERENCES dbo.ImportJobs(ImportJobID)
  END
END
GO

-- dbo.ImportRecordProvenance
IF OBJECT_ID(N'dbo.ImportRecordProvenance', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ImportRecordProvenance (
    ImportRecordProvenanceID BIGINT IDENTITY(1,1) NOT NULL,
    AccountID          INT NOT NULL,
    ImportJobID        INT NOT NULL,
    EntityType         NVARCHAR(40) NOT NULL,
    EntityID           INT NOT NULL,
    SourceRowNumber    INT NULL,
    SourceNaturalKey   NVARCHAR(256) NULL,
    ActionTaken        NVARCHAR(40) NULL,
    CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_ImportRecordProvenance_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_ImportRecordProvenance PRIMARY KEY CLUSTERED (ImportRecordProvenanceID)
  )

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_ImportRecordProvenance_ImportJobs'
      AND parent_object_id = OBJECT_ID('dbo.ImportRecordProvenance')
  )
  BEGIN
    ALTER TABLE dbo.ImportRecordProvenance
    ADD CONSTRAINT FK_ImportRecordProvenance_ImportJobs
    FOREIGN KEY (ImportJobID) REFERENCES dbo.ImportJobs(ImportJobID)
  END
END
GO

-- dbo.ImportUnmappedFields
IF OBJECT_ID(N'dbo.ImportUnmappedFields', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ImportUnmappedFields (
    ImportUnmappedFieldID BIGINT IDENTITY(1,1) NOT NULL,
    AccountID          INT NOT NULL,
    ImportJobID        INT NOT NULL,
    EntityType         NVARCHAR(40) NULL,
    EntityID           INT NULL,
    SourceColumnName   NVARCHAR(256) NOT NULL,
    SourceValue        NVARCHAR(2000) NULL,
    NormalizedFieldKey NVARCHAR(120) NULL,
    CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_ImportUnmappedFields_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_ImportUnmappedFields PRIMARY KEY CLUSTERED (ImportUnmappedFieldID)
  )

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_ImportUnmappedFields_ImportJobs'
      AND parent_object_id = OBJECT_ID('dbo.ImportUnmappedFields')
  )
  BEGIN
    ALTER TABLE dbo.ImportUnmappedFields
    ADD CONSTRAINT FK_ImportUnmappedFields_ImportJobs
    FOREIGN KEY (ImportJobID) REFERENCES dbo.ImportJobs(ImportJobID)
  END
END
GO

-- dbo.CustomFieldDefinitions
IF OBJECT_ID(N'dbo.CustomFieldDefinitions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomFieldDefinitions (
    CustomFieldID      INT IDENTITY(1,1) NOT NULL,
    AccountID          INT NULL,
    EntityType         NVARCHAR(40) NOT NULL,
    FieldKey           NVARCHAR(120) NOT NULL,
    DisplayLabel       NVARCHAR(200) NULL,
    DataType           NVARCHAR(40) NOT NULL,
    EnumOptionsJson    NVARCHAR(MAX) NULL,
    IsIndexed          BIT NOT NULL CONSTRAINT DF_CustomFieldDefinitions_IsIndexed DEFAULT (0),
    IsRequired         BIT NOT NULL CONSTRAINT DF_CustomFieldDefinitions_IsRequired DEFAULT (0),
    SortOrder          INT NOT NULL CONSTRAINT DF_CustomFieldDefinitions_SortOrder DEFAULT (0),
    CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_CustomFieldDefinitions_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt          DATETIME2 NOT NULL CONSTRAINT DF_CustomFieldDefinitions_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_CustomFieldDefinitions PRIMARY KEY CLUSTERED (CustomFieldID)
  )
END
GO

-- dbo.CustomFieldValues
IF OBJECT_ID(N'dbo.CustomFieldValues', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.CustomFieldValues (
    CustomFieldValueID BIGINT IDENTITY(1,1) NOT NULL,
    AccountID          INT NOT NULL,
    EntityType         NVARCHAR(40) NOT NULL,
    EntityID           INT NOT NULL,
    CustomFieldID      INT NOT NULL,
    ValueString        NVARCHAR(4000) NULL,
    ValueNumber        DECIMAL(18,6) NULL,
    ValueBool          BIT NULL,
    ValueDate          DATETIME2 NULL,
    ValueJson          NVARCHAR(MAX) NULL,
    CreatedAt          DATETIME2 NOT NULL CONSTRAINT DF_CustomFieldValues_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedAt          DATETIME2 NOT NULL CONSTRAINT DF_CustomFieldValues_UpdatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_CustomFieldValues PRIMARY KEY CLUSTERED (CustomFieldValueID)
  )

  IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_CustomFieldValues_CustomFieldDefinitions'
      AND parent_object_id = OBJECT_ID('dbo.CustomFieldValues')
  )
  BEGIN
    ALTER TABLE dbo.CustomFieldValues
    ADD CONSTRAINT FK_CustomFieldValues_CustomFieldDefinitions
    FOREIGN KEY (CustomFieldID) REFERENCES dbo.CustomFieldDefinitions(CustomFieldID)
  END
END
GO

/* =========================================================
   2) INDEXES / CONSTRAINTS (add if missing)
   ========================================================= */

-- A) Unique filtered index for tenant definitions
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_CustomFieldDefinitions_Account_Entity_FieldKey'
    AND object_id = OBJECT_ID('dbo.CustomFieldDefinitions')
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UX_CustomFieldDefinitions_Account_Entity_FieldKey
  ON dbo.CustomFieldDefinitions (AccountID, EntityType, FieldKey)
  WHERE AccountID IS NOT NULL
END
GO

-- Also ensure CustomFieldValues tenant uniqueness (needed by your upsert strategy)
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_CustomFieldValues_Account_Entity_Field'
    AND object_id = OBJECT_ID('dbo.CustomFieldValues')
)
BEGIN
  CREATE UNIQUE NONCLUSTERED INDEX UX_CustomFieldValues_Account_Entity_Field
  ON dbo.CustomFieldValues (AccountID, EntityType, EntityID, CustomFieldID)
END
GO

-- B) CHECK constraint on ImportJobs.JobStatus
IF NOT EXISTS (
  SELECT 1
  FROM sys.check_constraints
  WHERE name = 'CK_ImportJobs_JobStatus'
    AND parent_object_id = OBJECT_ID('dbo.ImportJobs')
)
BEGIN
  ALTER TABLE dbo.ImportJobs WITH CHECK
  ADD CONSTRAINT CK_ImportJobs_JobStatus
  CHECK (JobStatus IN (N'preview_created', N'preview_complete', N'running', N'succeeded', N'failed'))
END
GO
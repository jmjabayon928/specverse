-- Phase 4: LifecycleStates EntityType + Submittals + Deviations
-- A) LifecycleStates upgrade (Option B1)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.LifecycleStates') AND name = 'EntityType')
BEGIN
  ALTER TABLE dbo.LifecycleStates ADD EntityType varchar(40) NOT NULL CONSTRAINT DF_LifecycleStates_EntityType DEFAULT ('Sheet')
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.LifecycleStates') AND name = 'UX_LifecycleStates_Code')
  DROP INDEX UX_LifecycleStates_Code ON dbo.LifecycleStates
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.LifecycleStates') AND name = 'UX_LifecycleStates_EntityType_Code')
  CREATE UNIQUE NONCLUSTERED INDEX UX_LifecycleStates_EntityType_Code ON dbo.LifecycleStates (EntityType, Code)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.LifecycleStates') AND name = 'IX_LifecycleStates_EntityType_SortOrder')
  CREATE NONCLUSTERED INDEX IX_LifecycleStates_EntityType_SortOrder ON dbo.LifecycleStates (EntityType, SortOrder)
GO

-- B) Seed lifecycle rows (idempotent MERGE by EntityType, Code)
-- Sheet
MERGE dbo.LifecycleStates AS t
USING (SELECT 'Sheet' AS EntityType, 'DRAFT' AS Code, 10 AS SortOrder, 0 AS IsTerminal
       UNION ALL SELECT 'Sheet', 'SUBMITTED', 20, 0
       UNION ALL SELECT 'Sheet', 'VERIFIED', 30, 0
       UNION ALL SELECT 'Sheet', 'APPROVED', 40, 1
       UNION ALL SELECT 'Sheet', 'REJECTED', 50, 0
       UNION ALL SELECT 'Sheet', 'VOID', 60, 1) AS s (EntityType, Code, SortOrder, IsTerminal)
ON t.EntityType = s.EntityType AND t.Code = s.Code
WHEN NOT MATCHED BY TARGET THEN
  INSERT (EntityType, Code, Name, SortOrder, IsTerminal, CreatedAt, UpdatedAt)
  VALUES (s.EntityType, s.Code, s.Code, s.SortOrder, s.IsTerminal, SYSUTCDATETIME(), SYSUTCDATETIME());
GO

MERGE dbo.LifecycleStates AS t
USING (SELECT 'Submittal' AS EntityType, 'DRAFT' AS Code, 10 AS SortOrder, 0 AS IsTerminal
       UNION ALL SELECT 'Submittal', 'SUBMITTED', 20, 0
       UNION ALL SELECT 'Submittal', 'IN_REVIEW', 30, 0
       UNION ALL SELECT 'Submittal', 'APPROVED', 40, 1
       UNION ALL SELECT 'Submittal', 'REJECTED', 50, 1
       UNION ALL SELECT 'Submittal', 'SUPERSEDED', 60, 1) AS s (EntityType, Code, SortOrder, IsTerminal)
ON t.EntityType = s.EntityType AND t.Code = s.Code
WHEN NOT MATCHED BY TARGET THEN
  INSERT (EntityType, Code, Name, SortOrder, IsTerminal, CreatedAt, UpdatedAt)
  VALUES (s.EntityType, s.Code, s.Code, s.SortOrder, s.IsTerminal, SYSUTCDATETIME(), SYSUTCDATETIME());
GO

MERGE dbo.LifecycleStates AS t
USING (SELECT 'Deviation' AS EntityType, 'OPEN' AS Code, 10 AS SortOrder, 0 AS IsTerminal
       UNION ALL SELECT 'Deviation', 'IN_REVIEW', 20, 0
       UNION ALL SELECT 'Deviation', 'APPROVED', 30, 1
       UNION ALL SELECT 'Deviation', 'REJECTED', 40, 1
       UNION ALL SELECT 'Deviation', 'CLOSED', 50, 1
       UNION ALL SELECT 'Deviation', 'VOID', 60, 1) AS s (EntityType, Code, SortOrder, IsTerminal)
ON t.EntityType = s.EntityType AND t.Code = s.Code
WHEN NOT MATCHED BY TARGET THEN
  INSERT (EntityType, Code, Name, SortOrder, IsTerminal, CreatedAt, UpdatedAt)
  VALUES (s.EntityType, s.Code, s.Code, s.SortOrder, s.IsTerminal, SYSUTCDATETIME(), SYSUTCDATETIME());
GO

-- C) Backfill Sheets.LifecycleStateID
UPDATE dbo.Sheets
SET LifecycleStateID = (SELECT TOP 1 LifecycleStateID FROM dbo.LifecycleStates WHERE EntityType = 'Sheet' AND Code = 'DRAFT')
WHERE LifecycleStateID IS NULL
GO

-- D) Create Phase 4 tables (Account-scoped)
-- 1) Submittals
IF OBJECT_ID(N'dbo.Submittals', N'U') IS NULL
CREATE TABLE dbo.Submittals (
  SubmittalID int IDENTITY(1,1) NOT NULL,
  Title nvarchar(255) NOT NULL,
  Description nvarchar(max) NULL,
  LifecycleStateID int NOT NULL,
  ProjectID int NULL,
  ClientID int NULL,
  CreatedAt datetime2(6) NOT NULL CONSTRAINT DF_Submittals_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(6) NOT NULL CONSTRAINT DF_Submittals_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CreatedBy int NULL,
  UpdatedBy int NULL,
  AccountID int NOT NULL,
  CONSTRAINT PK_Submittals PRIMARY KEY CLUSTERED (SubmittalID),
  CONSTRAINT FK_Submittals_LifecycleStates FOREIGN KEY (LifecycleStateID) REFERENCES dbo.LifecycleStates (LifecycleStateID),
  CONSTRAINT FK_Submittals_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Submittals') AND name = 'IX_Submittals_AccountID_CreatedAt')
  CREATE NONCLUSTERED INDEX IX_Submittals_AccountID_CreatedAt ON dbo.Submittals (AccountID, CreatedAt DESC)
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Submittals') AND name = 'IX_Submittals_AccountID_LifecycleStateID')
  CREATE NONCLUSTERED INDEX IX_Submittals_AccountID_LifecycleStateID ON dbo.Submittals (AccountID, LifecycleStateID)
GO

-- 2) SubmittalLifecycleHistory
IF OBJECT_ID(N'dbo.SubmittalLifecycleHistory', N'U') IS NULL
CREATE TABLE dbo.SubmittalLifecycleHistory (
  HistoryID bigint IDENTITY(1,1) NOT NULL,
  SubmittalID int NOT NULL,
  FromLifecycleStateID int NULL,
  ToLifecycleStateID int NOT NULL,
  Note nvarchar(1000) NULL,
  ChangedAt datetime2(6) NOT NULL CONSTRAINT DF_SubmittalLifecycleHistory_ChangedAt DEFAULT SYSUTCDATETIME(),
  ChangedBy int NULL,
  AccountID int NOT NULL,
  CONSTRAINT PK_SubmittalLifecycleHistory PRIMARY KEY CLUSTERED (HistoryID),
  CONSTRAINT FK_SubmittalLifecycleHistory_Submittal FOREIGN KEY (SubmittalID) REFERENCES dbo.Submittals (SubmittalID) ON DELETE CASCADE,
  CONSTRAINT FK_SubmittalLifecycleHistory_From FOREIGN KEY (FromLifecycleStateID) REFERENCES dbo.LifecycleStates (LifecycleStateID),
  CONSTRAINT FK_SubmittalLifecycleHistory_To FOREIGN KEY (ToLifecycleStateID) REFERENCES dbo.LifecycleStates (LifecycleStateID),
  CONSTRAINT FK_SubmittalLifecycleHistory_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.SubmittalLifecycleHistory') AND name = 'IX_SubmittalLifecycleHistory_SubmittalID_ChangedAt')
  CREATE NONCLUSTERED INDEX IX_SubmittalLifecycleHistory_SubmittalID_ChangedAt ON dbo.SubmittalLifecycleHistory (SubmittalID, ChangedAt DESC)
GO

-- 3) SubmittalAttachments
IF OBJECT_ID(N'dbo.SubmittalAttachments', N'U') IS NULL
CREATE TABLE dbo.SubmittalAttachments (
  SubmittalID int NOT NULL,
  AttachmentID int NOT NULL,
  AccountID int NOT NULL,
  CreatedAt datetime2(6) NOT NULL CONSTRAINT DF_SubmittalAttachments_CreatedAt DEFAULT SYSUTCDATETIME(),
  CreatedBy int NULL,
  CONSTRAINT PK_SubmittalAttachments PRIMARY KEY CLUSTERED (SubmittalID, AttachmentID),
  CONSTRAINT FK_SubmittalAttachments_Submittal FOREIGN KEY (SubmittalID) REFERENCES dbo.Submittals (SubmittalID) ON DELETE CASCADE,
  CONSTRAINT FK_SubmittalAttachments_Attachment FOREIGN KEY (AttachmentID) REFERENCES dbo.Attachments (AttachmentID),
  CONSTRAINT FK_SubmittalAttachments_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.SubmittalAttachments') AND name = 'IX_SubmittalAttachments_AccountID')
  CREATE NONCLUSTERED INDEX IX_SubmittalAttachments_AccountID ON dbo.SubmittalAttachments (AccountID)
GO

-- 4) SubmittalLinks
IF OBJECT_ID(N'dbo.SubmittalLinks', N'U') IS NULL
CREATE TABLE dbo.SubmittalLinks (
  LinkID bigint IDENTITY(1,1) NOT NULL,
  SubmittalID int NOT NULL,
  ToEntityType varchar(40) NOT NULL,
  ToEntityID nvarchar(128) NOT NULL,
  RelationType varchar(40) NOT NULL,
  CreatedAt datetime2(6) NOT NULL CONSTRAINT DF_SubmittalLinks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CreatedBy int NULL,
  AccountID int NOT NULL,
  CONSTRAINT PK_SubmittalLinks PRIMARY KEY CLUSTERED (LinkID),
  CONSTRAINT FK_SubmittalLinks_Submittal FOREIGN KEY (SubmittalID) REFERENCES dbo.Submittals (SubmittalID) ON DELETE CASCADE,
  CONSTRAINT FK_SubmittalLinks_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.SubmittalLinks') AND name = 'IX_SubmittalLinks_SubmittalID')
  CREATE NONCLUSTERED INDEX IX_SubmittalLinks_SubmittalID ON dbo.SubmittalLinks (SubmittalID)
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.SubmittalLinks') AND name = 'IX_SubmittalLinks_To')
  CREATE NONCLUSTERED INDEX IX_SubmittalLinks_To ON dbo.SubmittalLinks (ToEntityType, ToEntityID)
GO

-- Deviations
IF OBJECT_ID(N'dbo.Deviations', N'U') IS NULL
CREATE TABLE dbo.Deviations (
  DeviationID int IDENTITY(1,1) NOT NULL,
  Title nvarchar(255) NOT NULL,
  Description nvarchar(max) NULL,
  LifecycleStateID int NOT NULL,
  ProjectID int NULL,
  ClientID int NULL,
  CreatedAt datetime2(6) NOT NULL CONSTRAINT DF_Deviations_CreatedAt DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2(6) NOT NULL CONSTRAINT DF_Deviations_UpdatedAt DEFAULT SYSUTCDATETIME(),
  CreatedBy int NULL,
  UpdatedBy int NULL,
  AccountID int NOT NULL,
  CONSTRAINT PK_Deviations PRIMARY KEY CLUSTERED (DeviationID),
  CONSTRAINT FK_Deviations_LifecycleStates FOREIGN KEY (LifecycleStateID) REFERENCES dbo.LifecycleStates (LifecycleStateID),
  CONSTRAINT FK_Deviations_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Deviations') AND name = 'IX_Deviations_AccountID_CreatedAt')
  CREATE NONCLUSTERED INDEX IX_Deviations_AccountID_CreatedAt ON dbo.Deviations (AccountID, CreatedAt DESC)
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Deviations') AND name = 'IX_Deviations_AccountID_LifecycleStateID')
  CREATE NONCLUSTERED INDEX IX_Deviations_AccountID_LifecycleStateID ON dbo.Deviations (AccountID, LifecycleStateID)
GO

IF OBJECT_ID(N'dbo.DeviationLifecycleHistory', N'U') IS NULL
CREATE TABLE dbo.DeviationLifecycleHistory (
  HistoryID bigint IDENTITY(1,1) NOT NULL,
  DeviationID int NOT NULL,
  FromLifecycleStateID int NULL,
  ToLifecycleStateID int NOT NULL,
  Note nvarchar(1000) NULL,
  ChangedAt datetime2(6) NOT NULL CONSTRAINT DF_DeviationLifecycleHistory_ChangedAt DEFAULT SYSUTCDATETIME(),
  ChangedBy int NULL,
  AccountID int NOT NULL,
  CONSTRAINT PK_DeviationLifecycleHistory PRIMARY KEY CLUSTERED (HistoryID),
  CONSTRAINT FK_DeviationLifecycleHistory_Deviation FOREIGN KEY (DeviationID) REFERENCES dbo.Deviations (DeviationID) ON DELETE CASCADE,
  CONSTRAINT FK_DeviationLifecycleHistory_From FOREIGN KEY (FromLifecycleStateID) REFERENCES dbo.LifecycleStates (LifecycleStateID),
  CONSTRAINT FK_DeviationLifecycleHistory_To FOREIGN KEY (ToLifecycleStateID) REFERENCES dbo.LifecycleStates (LifecycleStateID),
  CONSTRAINT FK_DeviationLifecycleHistory_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.DeviationLifecycleHistory') AND name = 'IX_DeviationLifecycleHistory_DeviationID_ChangedAt')
  CREATE NONCLUSTERED INDEX IX_DeviationLifecycleHistory_DeviationID_ChangedAt ON dbo.DeviationLifecycleHistory (DeviationID, ChangedAt DESC)
GO

IF OBJECT_ID(N'dbo.DeviationAttachments', N'U') IS NULL
CREATE TABLE dbo.DeviationAttachments (
  DeviationID int NOT NULL,
  AttachmentID int NOT NULL,
  AccountID int NOT NULL,
  CreatedAt datetime2(6) NOT NULL CONSTRAINT DF_DeviationAttachments_CreatedAt DEFAULT SYSUTCDATETIME(),
  CreatedBy int NULL,
  CONSTRAINT PK_DeviationAttachments PRIMARY KEY CLUSTERED (DeviationID, AttachmentID),
  CONSTRAINT FK_DeviationAttachments_Deviation FOREIGN KEY (DeviationID) REFERENCES dbo.Deviations (DeviationID) ON DELETE CASCADE,
  CONSTRAINT FK_DeviationAttachments_Attachment FOREIGN KEY (AttachmentID) REFERENCES dbo.Attachments (AttachmentID),
  CONSTRAINT FK_DeviationAttachments_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.DeviationAttachments') AND name = 'IX_DeviationAttachments_AccountID')
  CREATE NONCLUSTERED INDEX IX_DeviationAttachments_AccountID ON dbo.DeviationAttachments (AccountID)
GO

IF OBJECT_ID(N'dbo.DeviationLinks', N'U') IS NULL
CREATE TABLE dbo.DeviationLinks (
  LinkID bigint IDENTITY(1,1) NOT NULL,
  DeviationID int NOT NULL,
  ToEntityType varchar(40) NOT NULL,
  ToEntityID nvarchar(128) NOT NULL,
  RelationType varchar(40) NOT NULL,
  CreatedAt datetime2(6) NOT NULL CONSTRAINT DF_DeviationLinks_CreatedAt DEFAULT SYSUTCDATETIME(),
  CreatedBy int NULL,
  AccountID int NOT NULL,
  CONSTRAINT PK_DeviationLinks PRIMARY KEY CLUSTERED (LinkID),
  CONSTRAINT FK_DeviationLinks_Deviation FOREIGN KEY (DeviationID) REFERENCES dbo.Deviations (DeviationID) ON DELETE CASCADE,
  CONSTRAINT FK_DeviationLinks_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts (AccountID)
)
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.DeviationLinks') AND name = 'IX_DeviationLinks_DeviationID')
  CREATE NONCLUSTERED INDEX IX_DeviationLinks_DeviationID ON dbo.DeviationLinks (DeviationID)
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.DeviationLinks') AND name = 'IX_DeviationLinks_To')
  CREATE NONCLUSTERED INDEX IX_DeviationLinks_To ON dbo.DeviationLinks (ToEntityType, ToEntityID)
GO

-- E) Seed permissions (idempotent inserts)
INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'submittals.read', 'View submittals', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'submittals.read');

INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'submittals.create', 'Create submittals', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'submittals.create');

INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'submittals.update', 'Update submittals', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'submittals.update');

INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'submittals.transition', 'Transition submittal lifecycle', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'submittals.transition');

INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'deviations.read', 'View deviations', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'deviations.read');

INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'deviations.create', 'Create deviations', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'deviations.create');

INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'deviations.update', 'Update deviations', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'deviations.update');

INSERT INTO dbo.Permissions (PermissionKey, Description, CreatedAt, UpdatedAt)
SELECT 'deviations.transition', 'Transition deviation lifecycle', SYSUTCDATETIME(), SYSUTCDATETIME()
WHERE NOT EXISTS (SELECT 1 FROM dbo.Permissions WHERE PermissionKey = 'deviations.transition');
GO

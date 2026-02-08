-- Phase 5.1 Instrumentation baseline: create Instruments, InstrumentLoops, InstrumentLoopMembers, InstrumentDatasheetLinks if missing.
-- Does NOT drop or alter existing objects. Does NOT touch LoopInstruments.
-- Database: SQL Server (DataSheets). Idempotent: safe to re-run.
-- Prerequisite: Phase 2.5 (Accounts, Sheets with AccountID) applied.

USE DataSheets;
GO

-- =============================================================================
-- A. dbo.Instruments (create only if missing)
-- =============================================================================
IF OBJECT_ID(N'dbo.Instruments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Instruments (
        InstrumentID      INT           IDENTITY(1,1) NOT NULL,
        AccountID         INT           NOT NULL,
        InstrumentTag     NVARCHAR(255) NOT NULL,
        InstrumentTagNorm NVARCHAR(255) NULL,
        InstrumentType    NVARCHAR(100) NULL,
        Service           NVARCHAR(255) NULL,
        System            NVARCHAR(255) NULL,
        Area              NVARCHAR(255) NULL,
        Location          NVARCHAR(255) NULL,
        Status            NVARCHAR(50)  NULL,
        Notes             NVARCHAR(MAX) NULL,
        CreatedAt         DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt         DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy         INT           NULL,
        UpdatedBy         INT           NULL,
        CONSTRAINT PK_Instruments PRIMARY KEY (InstrumentID),
        CONSTRAINT FK_Instruments_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID)
    );
    PRINT 'dbo.Instruments created.';
END
ELSE
    PRINT 'dbo.Instruments already exists.';
GO

IF OBJECT_ID(N'dbo.Instruments', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Instruments') AND name = N'IX_Instruments_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Instruments_AccountID ON dbo.Instruments (AccountID);
    PRINT 'IX_Instruments_AccountID created.';
END
GO

IF OBJECT_ID(N'dbo.Instruments', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Instruments') AND name = N'IX_Instruments_InstrumentTagNorm')
BEGIN
    CREATE NONCLUSTERED INDEX IX_Instruments_InstrumentTagNorm ON dbo.Instruments (AccountID, InstrumentTagNorm);
    PRINT 'IX_Instruments_InstrumentTagNorm created.';
END
GO

-- =============================================================================
-- B. dbo.InstrumentLoops (create only if missing)
-- =============================================================================
IF OBJECT_ID(N'dbo.InstrumentLoops', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.InstrumentLoops (
        LoopID      INT           IDENTITY(1,1) NOT NULL,
        LoopTag     NVARCHAR(255) NOT NULL,
        LoopTagNorm NVARCHAR(255) NULL,
        Service     NVARCHAR(255) NULL,
        System      NVARCHAR(255) NULL,
        Status      NVARCHAR(50)  NOT NULL DEFAULT N'Active',
        AccountID   INT           NULL,
        CreatedAt   DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2(0)  NOT NULL DEFAULT SYSUTCDATETIME(),
        LockedAt    DATETIME2(0)  NULL,
        LockedBy    INT           NULL,
        CONSTRAINT PK_InstrumentLoops PRIMARY KEY (LoopID),
        CONSTRAINT FK_InstrumentLoops_AccountID FOREIGN KEY (AccountID) REFERENCES dbo.Accounts(AccountID)
    );
    PRINT 'dbo.InstrumentLoops created.';
END
ELSE
    PRINT 'dbo.InstrumentLoops already exists.';
GO

IF OBJECT_ID(N'dbo.InstrumentLoops', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.InstrumentLoops') AND name = N'IX_InstrumentLoops_AccountID')
BEGIN
    CREATE NONCLUSTERED INDEX IX_InstrumentLoops_AccountID ON dbo.InstrumentLoops (AccountID);
    PRINT 'IX_InstrumentLoops_AccountID created.';
END
GO

-- =============================================================================
-- C. dbo.InstrumentLoopMembers (create only if missing)
-- =============================================================================
IF OBJECT_ID(N'dbo.InstrumentLoopMembers', N'U') IS NULL
   AND OBJECT_ID(N'dbo.Instruments', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.InstrumentLoops', N'U') IS NOT NULL
BEGIN
    CREATE TABLE dbo.InstrumentLoopMembers (
        InstrumentLoopMemberID INT IDENTITY(1,1) NOT NULL,
        AccountID             INT NOT NULL,
        LoopID                INT NOT NULL,
        InstrumentID          INT NOT NULL,
        Role                  NVARCHAR(100) NULL,
        CreatedAt             DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy              INT NULL,
        CONSTRAINT PK_InstrumentLoopMembers PRIMARY KEY (InstrumentLoopMemberID),
        CONSTRAINT FK_InstrumentLoopMembers_AccountID    FOREIGN KEY (AccountID)    REFERENCES dbo.Accounts(AccountID),
        CONSTRAINT FK_InstrumentLoopMembers_LoopID       FOREIGN KEY (LoopID)       REFERENCES dbo.InstrumentLoops(LoopID),
        CONSTRAINT FK_InstrumentLoopMembers_InstrumentID FOREIGN KEY (InstrumentID) REFERENCES dbo.Instruments(InstrumentID)
    );
    CREATE NONCLUSTERED INDEX IX_InstrumentLoopMembers_AccountID ON dbo.InstrumentLoopMembers (AccountID);
    CREATE NONCLUSTERED INDEX IX_InstrumentLoopMembers_LoopID ON dbo.InstrumentLoopMembers (LoopID);
    CREATE NONCLUSTERED INDEX IX_InstrumentLoopMembers_InstrumentID ON dbo.InstrumentLoopMembers (InstrumentID);
    PRINT 'dbo.InstrumentLoopMembers created.';
END
ELSE
    PRINT 'dbo.InstrumentLoopMembers already exists or dependencies missing.';
GO

-- =============================================================================
-- D. dbo.InstrumentDatasheetLinks (create only if missing)
-- =============================================================================
IF OBJECT_ID(N'dbo.InstrumentDatasheetLinks', N'U') IS NULL
   AND OBJECT_ID(N'dbo.Instruments', N'U') IS NOT NULL
BEGIN
    CREATE TABLE dbo.InstrumentDatasheetLinks (
        InstrumentDatasheetLinkID INT IDENTITY(1,1) NOT NULL,
        AccountID                INT NOT NULL,
        InstrumentID             INT NOT NULL,
        SheetID                  INT NOT NULL,
        LinkRole                 NVARCHAR(100) NULL,
        CreatedAt                DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedBy                INT NULL,
        CONSTRAINT PK_InstrumentDatasheetLinks PRIMARY KEY (InstrumentDatasheetLinkID),
        CONSTRAINT FK_InstrumentDatasheetLinks_AccountID    FOREIGN KEY (AccountID)    REFERENCES dbo.Accounts(AccountID),
        CONSTRAINT FK_InstrumentDatasheetLinks_InstrumentID FOREIGN KEY (InstrumentID) REFERENCES dbo.Instruments(InstrumentID),
        CONSTRAINT FK_InstrumentDatasheetLinks_SheetID     FOREIGN KEY (SheetID)      REFERENCES dbo.Sheets(SheetID)
    );
    CREATE NONCLUSTERED INDEX IX_InstrumentDatasheetLinks_AccountID ON dbo.InstrumentDatasheetLinks (AccountID);
    CREATE NONCLUSTERED INDEX IX_InstrumentDatasheetLinks_InstrumentID ON dbo.InstrumentDatasheetLinks (InstrumentID);
    CREATE NONCLUSTERED INDEX IX_InstrumentDatasheetLinks_SheetID ON dbo.InstrumentDatasheetLinks (SheetID);
    PRINT 'dbo.InstrumentDatasheetLinks created.';
END
ELSE
    PRINT 'dbo.InstrumentDatasheetLinks already exists or dependencies missing.';
GO

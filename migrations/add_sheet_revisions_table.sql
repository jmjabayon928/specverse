-- Migration: Add SheetRevisions table for revision history (Feature 4 MVP)
-- Created: 2026-01-28
-- Purpose: Store immutable revision snapshots for filled sheets

USE DataSheets;
GO

-- Create SheetRevisions table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.SheetRevisions') AND type in (N'U'))
BEGIN
    CREATE TABLE dbo.SheetRevisions (
        RevisionID INT IDENTITY(1,1) PRIMARY KEY,
        SheetID INT NOT NULL,
        RevisionNumber INT NOT NULL,
        SnapshotJson NVARCHAR(MAX) NOT NULL,
        CreatedBy INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        Comment NVARCHAR(1000) NULL,
        Status NVARCHAR(50) NULL,
        CONSTRAINT FK_SheetRevisions_SheetID FOREIGN KEY (SheetID) REFERENCES dbo.Sheets(SheetID) ON DELETE CASCADE,
        CONSTRAINT FK_SheetRevisions_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.Users(UserID),
        CONSTRAINT UQ_SheetRevisions_SheetID_RevisionNumber UNIQUE (SheetID, RevisionNumber)
    );

    -- Indexes for efficient queries
    CREATE INDEX IX_SheetRevisions_SheetID ON dbo.SheetRevisions(SheetID);
    CREATE INDEX IX_SheetRevisions_SheetID_RevisionNumber ON dbo.SheetRevisions(SheetID, RevisionNumber DESC);
    
    PRINT 'SheetRevisions table created successfully.';
END
ELSE
BEGIN
    PRINT 'SheetRevisions table already exists.';
END
GO

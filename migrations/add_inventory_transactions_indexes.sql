-- Manual optional performance indexes for InventoryTransactions (filters + pagination).
-- Run in SSMS against the database that contains dbo.InventoryTransactions. Idempotent (skips if index exists).

-- Composite index for list order and pagination (OFFSET/FETCH)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.InventoryTransactions')
      AND name = N'IX_InventoryTransactions_PerformedAt_TransactionID'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_InventoryTransactions_PerformedAt_TransactionID
    ON dbo.InventoryTransactions (PerformedAt DESC, TransactionID DESC);
    PRINT 'IX_InventoryTransactions_PerformedAt_TransactionID created.';
END
ELSE
    PRINT 'IX_InventoryTransactions_PerformedAt_TransactionID already exists.';
GO

-- Index for itemId (InventoryID) filter
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.InventoryTransactions')
      AND name = N'IX_InventoryTransactions_InventoryID'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_InventoryTransactions_InventoryID
    ON dbo.InventoryTransactions (InventoryID);
    PRINT 'IX_InventoryTransactions_InventoryID created.';
END
ELSE
    PRINT 'IX_InventoryTransactions_InventoryID already exists.';
GO

-- Index for transactionType filter (optional, small cardinality)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.InventoryTransactions')
      AND name = N'IX_InventoryTransactions_TransactionType'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_InventoryTransactions_TransactionType
    ON dbo.InventoryTransactions (TransactionType);
    PRINT 'IX_InventoryTransactions_TransactionType created.';
END
ELSE
    PRINT 'IX_InventoryTransactions_TransactionType already exists.';
GO

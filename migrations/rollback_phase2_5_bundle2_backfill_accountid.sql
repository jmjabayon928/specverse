-- Rollback: Phase 2.5 Bundle 2 — backfill (best-effort / no-op)
-- There is no safe row-level revert for backfill: data was set to default AccountID.
-- This script is a documented no-op. Run rollback_phase2_5_bundle2_constraints_and_indexes.sql
-- first, then rollback_phase2_5_bundle2_drop_accountid_columns.sql to remove the column.

USE DataSheets;
GO

PRINT 'Phase 2.5 Bundle 2 backfill rollback: No row-level revert (data remains with default AccountID until column is dropped). Proceed to rollback_phase2_5_bundle2_drop_accountid_columns.sql.';
GO

// src/backend/repositories/invitesRepository.ts
import { poolPromise, sql } from '../config/db'

export type InviteStatus = 'Pending' | 'Accepted' | 'Revoked' | 'Declined' | 'Expired'

export type InviteRow = {
  inviteId: number
  accountId: number
  email: string
  roleId: number
  tokenHash: string
  status: InviteStatus
  expiresAt: Date
  invitedByUserId: number
  createdAt: Date
  updatedAt: Date
  acceptedByUserId: number | null
  acceptedAt: Date | null
  revokedByUserId: number | null
  revokedAt: Date | null
  sendCount: number
  lastSentAt: Date | null
}

export type InviteRowWithDetails = InviteRow & {
  accountName: string
  inviterName: string | null
  roleName: string
}

function mapInviteRow(r: {
  InviteID: number
  AccountID: number
  Email: string
  RoleID: number
  TokenHash: string
  Status: string
  ExpiresAt: Date
  InvitedByUserID: number
  CreatedAt: Date
  UpdatedAt: Date
  AcceptedByUserID: number | null
  AcceptedAt: Date | null
  RevokedByUserID: number | null
  RevokedAt: Date | null
  SendCount: number
  LastSentAt: Date | null
  AccountName?: string
  InviterName?: string | null
  RoleName?: string
}): InviteRow | InviteRowWithDetails {
  const row: InviteRow = {
    inviteId: r.InviteID,
    accountId: r.AccountID,
    email: r.Email,
    roleId: r.RoleID,
    tokenHash: r.TokenHash,
    status: r.Status as InviteStatus,
    expiresAt: r.ExpiresAt,
    invitedByUserId: r.InvitedByUserID,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
    acceptedByUserId: r.AcceptedByUserID,
    acceptedAt: r.AcceptedAt,
    revokedByUserId: r.RevokedByUserID,
    revokedAt: r.RevokedAt,
    sendCount: r.SendCount,
    lastSentAt: r.LastSentAt,
  }
  if (r.AccountName !== undefined && r.InviterName !== undefined && r.RoleName !== undefined) {
    return { ...row, accountName: r.AccountName, inviterName: r.InviterName, roleName: r.RoleName }
  }
  return row
}

/**
 * Creates a new invite. Caller must ensure (AccountID, Email) has no existing Pending invite or use findPendingByAccountAndEmail first.
 */
export async function createInvite(
  accountId: number,
  email: string,
  roleId: number,
  tokenHash: string,
  expiresAt: Date,
  invitedByUserId: number,
): Promise<InviteRow> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('Email', sql.NVarChar(255), email)
    .input('RoleID', sql.Int, roleId)
    .input('TokenHash', sql.Char(64), tokenHash)
    .input('ExpiresAt', sql.DateTime2(0), expiresAt)
    .input('InvitedByUserID', sql.Int, invitedByUserId)
    .query<{
      InviteID: number
      AccountID: number
      Email: string
      RoleID: number
      TokenHash: string
      Status: string
      ExpiresAt: Date
      InvitedByUserID: number
      CreatedAt: Date
      UpdatedAt: Date
      AcceptedByUserID: number | null
      AcceptedAt: Date | null
      RevokedByUserID: number | null
      RevokedAt: Date | null
      SendCount: number
      LastSentAt: Date | null
    }>(`
      INSERT INTO dbo.AccountInvites (AccountID, Email, RoleID, TokenHash, Status, ExpiresAt, InvitedByUserID, SendCount, LastSentAt)
      OUTPUT INSERTED.InviteID, INSERTED.AccountID, INSERTED.Email, INSERTED.RoleID, INSERTED.TokenHash, INSERTED.Status,
             INSERTED.ExpiresAt, INSERTED.InvitedByUserID, INSERTED.CreatedAt, INSERTED.UpdatedAt,
             INSERTED.AcceptedByUserID, INSERTED.AcceptedAt, INSERTED.RevokedByUserID, INSERTED.RevokedAt,
             INSERTED.SendCount, INSERTED.LastSentAt
      VALUES (@AccountID, @Email, @RoleID, @TokenHash, N'Pending', @ExpiresAt, @InvitedByUserID, 1, GETDATE())
    `)
  const r = result.recordset[0]
  if (!r) throw new Error('Insert AccountInvites did not return row')
  return mapInviteRow(r) as InviteRow
}

/**
 * Finds a Pending invite for (accountId, email). Used for create-or-resend.
 */
export async function findPendingByAccountAndEmail(
  accountId: number,
  email: string,
): Promise<InviteRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('Email', sql.NVarChar(255), email)
    .query<{
      InviteID: number
      AccountID: number
      Email: string
      RoleID: number
      TokenHash: string
      Status: string
      ExpiresAt: Date
      InvitedByUserID: number
      CreatedAt: Date
      UpdatedAt: Date
      AcceptedByUserID: number | null
      AcceptedAt: Date | null
      RevokedByUserID: number | null
      RevokedAt: Date | null
      SendCount: number
      LastSentAt: Date | null
    }>(`
      SELECT InviteID, AccountID, Email, RoleID, TokenHash, Status, ExpiresAt,
             InvitedByUserID, CreatedAt, UpdatedAt, AcceptedByUserID, AcceptedAt,
             RevokedByUserID, RevokedAt, SendCount, LastSentAt
      FROM dbo.AccountInvites
      WHERE AccountID = @AccountID AND Email = @Email AND Status = N'Pending'
    `)
  const row = result.recordset[0]
  if (!row) return null
  return mapInviteRow(row) as InviteRow
}

/**
 * Lists Pending invites for the account (Status = Pending only).
 */
export async function listPendingByAccount(accountId: number): Promise<InviteRowWithDetails[]> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .query<{
      InviteID: number
      AccountID: number
      Email: string
      RoleID: number
      TokenHash: string
      Status: string
      ExpiresAt: Date
      InvitedByUserID: number
      CreatedAt: Date
      UpdatedAt: Date
      AcceptedByUserID: number | null
      AcceptedAt: Date | null
      RevokedByUserID: number | null
      RevokedAt: Date | null
      SendCount: number
      LastSentAt: Date | null
      AccountName: string
      InviterName: string | null
      RoleName: string
    }>(`
      SELECT i.InviteID, i.AccountID, i.Email, i.RoleID, i.TokenHash, i.Status, i.ExpiresAt,
             i.InvitedByUserID, i.CreatedAt, i.UpdatedAt, i.AcceptedByUserID, i.AcceptedAt,
             i.RevokedByUserID, i.RevokedAt, i.SendCount, i.LastSentAt,
             a.AccountName,
             u.FirstName + COALESCE(N' ' + NULLIF(u.LastName, N''), N'') AS InviterName,
             r.RoleName
      FROM dbo.AccountInvites i
      INNER JOIN dbo.Accounts a ON a.AccountID = i.AccountID
      INNER JOIN dbo.Users u ON u.UserID = i.InvitedByUserID
      INNER JOIN dbo.Roles r ON r.RoleID = i.RoleID
      WHERE i.AccountID = @AccountID AND i.Status = N'Pending'
      ORDER BY i.CreatedAt DESC
    `)
  return (result.recordset ?? []).map(r => mapInviteRow(r) as InviteRowWithDetails)
}

/**
 * Finds invite by token hash. Returns row with account and inviter names for by-token and accept.
 */
export async function findByTokenHash(tokenHash: string): Promise<InviteRowWithDetails | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('TokenHash', sql.Char(64), tokenHash)
    .query<{
      InviteID: number
      AccountID: number
      Email: string
      RoleID: number
      TokenHash: string
      Status: string
      ExpiresAt: Date
      InvitedByUserID: number
      CreatedAt: Date
      UpdatedAt: Date
      AcceptedByUserID: number | null
      AcceptedAt: Date | null
      RevokedByUserID: number | null
      RevokedAt: Date | null
      SendCount: number
      LastSentAt: Date | null
      AccountName: string
      InviterName: string | null
      RoleName: string
    }>(`
      SELECT i.InviteID, i.AccountID, i.Email, i.RoleID, i.TokenHash, i.Status, i.ExpiresAt,
             i.InvitedByUserID, i.CreatedAt, i.UpdatedAt, i.AcceptedByUserID, i.AcceptedAt,
             i.RevokedByUserID, i.RevokedAt, i.SendCount, i.LastSentAt,
             a.AccountName,
             u.FirstName + COALESCE(N' ' + NULLIF(u.LastName, N''), N'') AS InviterName,
             r.RoleName
      FROM dbo.AccountInvites i
      INNER JOIN dbo.Accounts a ON a.AccountID = i.AccountID
      INNER JOIN dbo.Users u ON u.UserID = i.InvitedByUserID
      INNER JOIN dbo.Roles r ON r.RoleID = i.RoleID
      WHERE i.TokenHash = @TokenHash
    `)
  const row = result.recordset[0]
  if (!row) return null
  return mapInviteRow(row) as InviteRowWithDetails
}

/**
 * Gets invite by id and account (for authorize resend/revoke).
 */
export async function getByIdAndAccount(
  inviteId: number,
  accountId: number,
): Promise<InviteRow | null> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('InviteID', sql.Int, inviteId)
    .input('AccountID', sql.Int, accountId)
    .query<{
      InviteID: number
      AccountID: number
      Email: string
      RoleID: number
      TokenHash: string
      Status: string
      ExpiresAt: Date
      InvitedByUserID: number
      CreatedAt: Date
      UpdatedAt: Date
      AcceptedByUserID: number | null
      AcceptedAt: Date | null
      RevokedByUserID: number | null
      RevokedAt: Date | null
      SendCount: number
      LastSentAt: Date | null
    }>(`
      SELECT InviteID, AccountID, Email, RoleID, TokenHash, Status, ExpiresAt,
             InvitedByUserID, CreatedAt, UpdatedAt, AcceptedByUserID, AcceptedAt,
             RevokedByUserID, RevokedAt, SendCount, LastSentAt
      FROM dbo.AccountInvites
      WHERE InviteID = @InviteID AND AccountID = @AccountID
    `)
  const row = result.recordset[0]
  if (!row) return null
  return mapInviteRow(row) as InviteRow
}

/**
 * Rotates token and increments send count (resend).
 */
export async function updateTokenAndIncrementSend(
  inviteId: number,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('InviteID', sql.Int, inviteId)
    .input('TokenHash', sql.Char(64), tokenHash)
    .input('ExpiresAt', sql.DateTime2(0), expiresAt)
    .query(`
      UPDATE dbo.AccountInvites
      SET TokenHash = @TokenHash, ExpiresAt = @ExpiresAt,
          SendCount = SendCount + 1, LastSentAt = GETDATE(), UpdatedAt = GETDATE()
      WHERE InviteID = @InviteID
    `)
}

/**
 * Sets status to Revoked.
 */
export async function setStatusRevoked(
  inviteId: number,
  revokedByUserId: number,
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('InviteID', sql.Int, inviteId)
    .input('RevokedByUserID', sql.Int, revokedByUserId)
    .query(`
      UPDATE dbo.AccountInvites
      SET Status = N'Revoked', RevokedByUserID = @RevokedByUserID, RevokedAt = GETDATE(), UpdatedAt = GETDATE()
      WHERE InviteID = @InviteID
    `)
}

/**
 * Sets status to Accepted. Unconditional (use for single-acceptor flow).
 */
export async function setStatusAccepted(
  inviteId: number,
  acceptedByUserId: number,
): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('InviteID', sql.Int, inviteId)
    .input('AcceptedByUserID', sql.Int, acceptedByUserId)
    .query(`
      UPDATE dbo.AccountInvites
      SET Status = N'Accepted', AcceptedByUserID = @AcceptedByUserID, AcceptedAt = GETDATE(), UpdatedAt = GETDATE()
      WHERE InviteID = @InviteID
    `)
}

/**
 * Sets status to Accepted only when Status is Pending (atomic single-use).
 * Returns true if one row was updated, false otherwise (prevents double-accept).
 */
export async function setStatusAcceptedIfPending(
  inviteId: number,
  acceptedByUserId: number,
): Promise<boolean> {
  const pool = await poolPromise
  const result = await pool
    .request()
    .input('InviteID', sql.Int, inviteId)
    .input('AcceptedByUserID', sql.Int, acceptedByUserId)
    .query(`
      UPDATE dbo.AccountInvites
      SET Status = N'Accepted', AcceptedByUserID = @AcceptedByUserID, AcceptedAt = GETDATE(), UpdatedAt = GETDATE()
      WHERE InviteID = @InviteID AND Status = N'Pending'
    `)
  const rowsAffected = (result as { rowsAffected?: number[] }).rowsAffected?.[0] ?? 0
  return rowsAffected === 1
}

/**
 * Sets status to Declined (no user id; public decline).
 */
export async function setStatusDeclined(inviteId: number): Promise<void> {
  const pool = await poolPromise
  await pool
    .request()
    .input('InviteID', sql.Int, inviteId)
    .query(`
      UPDATE dbo.AccountInvites
      SET Status = N'Declined', UpdatedAt = GETDATE()
      WHERE InviteID = @InviteID
    `)
}

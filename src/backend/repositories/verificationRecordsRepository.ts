// src/backend/repositories/verificationRecordsRepository.ts
import { poolPromise, sql } from '../config/db'
import type { CreateVerificationRecordDto } from '@/domain/verification/verificationTypes'

export type VerificationRecordRow = {
  verificationRecordId: number
  accountId: number
}

export type VerificationRecordLinkRow = {
  accountId: number
  verificationRecordId: number
  sheetId: number | null
}

export type VerificationRecordAttachmentRow = {
  verificationRecordId: number
  attachmentId: number
}

export type VerificationRecordTypeRow = {
  verificationTypeId: number
  code: string
  name: string
  status: string
}

export const listVerificationRecordsForAccount = async (
  accountId: number,
  opts?: { limit?: number; offset?: number }
): Promise<VerificationRecordRow[]> => {
  const pool = await poolPromise
  const limit = opts?.limit ?? 100
  const offset = opts?.offset ?? 0

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('Offset', sql.Int, offset)
    .input('Limit', sql.Int, limit)
    .query(`
      SELECT VerificationRecordID AS verificationRecordId, AccountID AS accountId
      FROM VerificationRecords
      WHERE AccountID = @AccountID
      ORDER BY VerificationRecordID
      OFFSET @Offset ROWS
      FETCH NEXT @Limit ROWS ONLY
    `)

  return result.recordset as VerificationRecordRow[]
}

export const getVerificationRecordById = async (
  accountId: number,
  verificationRecordId: number
): Promise<VerificationRecordRow | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('VerificationRecordID', sql.Int, verificationRecordId)
    .query(`
      SELECT VerificationRecordID AS verificationRecordId, AccountID AS accountId
      FROM VerificationRecords
      WHERE AccountID = @AccountID AND VerificationRecordID = @VerificationRecordID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0] as VerificationRecordRow
}

export const listVerificationRecordsForSheet = async (
  accountId: number,
  sheetId: number
): Promise<VerificationRecordRow[]> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      SELECT vr.VerificationRecordID AS verificationRecordId, vr.AccountID AS accountId
      FROM VerificationRecordLinks vrl
      INNER JOIN VerificationRecords vr ON vr.VerificationRecordID = vrl.VerificationRecordID
      WHERE vrl.AccountID = @AccountID AND vrl.SheetID = @SheetID AND vr.AccountID = @AccountID
      ORDER BY vr.VerificationRecordID
    `)

  return result.recordset as VerificationRecordRow[]
}

export const createVerificationRecord = async (
  accountId: number,
  input: CreateVerificationRecordDto
): Promise<VerificationRecordRow> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('VerificationTypeID', sql.Int, input.verificationTypeId)
    .input('Result', sql.NVarChar, input.result)
    .query(`
      INSERT INTO VerificationRecords (AccountID, VerificationTypeID, Result)
      OUTPUT INSERTED.VerificationRecordID AS verificationRecordId, INSERTED.AccountID AS accountId
      VALUES (@AccountID, @VerificationTypeID, @Result)
    `)

  return result.recordset[0] as VerificationRecordRow
}

export const linkVerificationRecordToSheet = async (
  accountId: number,
  verificationRecordId: number,
  sheetId: number
): Promise<VerificationRecordLinkRow> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('VerificationRecordID', sql.Int, verificationRecordId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      INSERT INTO VerificationRecordLinks (AccountID, VerificationRecordID, SheetID)
      OUTPUT INSERTED.AccountID AS accountId, INSERTED.VerificationRecordID AS verificationRecordId, INSERTED.SheetID AS sheetId
      VALUES (@AccountID, @VerificationRecordID, @SheetID)
    `)

  return result.recordset[0] as VerificationRecordLinkRow
}

export const unlinkVerificationRecordFromSheet = async (
  accountId: number,
  verificationRecordId: number,
  sheetId: number
): Promise<boolean> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('VerificationRecordID', sql.Int, verificationRecordId)
    .input('SheetID', sql.Int, sheetId)
    .query(`
      DELETE FROM VerificationRecordLinks
      WHERE AccountID = @AccountID AND VerificationRecordID = @VerificationRecordID AND SheetID = @SheetID
    `)

  const totalRows = Array.isArray(result.rowsAffected)
    ? result.rowsAffected.reduce((sum, value) => sum + value, 0)
    : 0

  return totalRows > 0
}

export const attachEvidenceToVerificationRecord = async (
  accountId: number,
  verificationRecordId: number,
  attachmentId: number
): Promise<VerificationRecordAttachmentRow | null> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('VerificationRecordID', sql.Int, verificationRecordId)
    .input('AttachmentID', sql.Int, attachmentId)
    .query(`
      INSERT INTO VerificationRecordAttachments (VerificationRecordID, AttachmentID)
      OUTPUT INSERTED.VerificationRecordID AS verificationRecordId, INSERTED.AttachmentID AS attachmentId
      SELECT @VerificationRecordID, @AttachmentID
      FROM VerificationRecords vr
      WHERE vr.VerificationRecordID = @VerificationRecordID AND vr.AccountID = @AccountID
    `)

  if (result.recordset.length === 0) {
    return null
  }

  return result.recordset[0] as VerificationRecordAttachmentRow
}

export const listVerificationRecordAttachments = async (
  accountId: number,
  verificationRecordId: number
): Promise<VerificationRecordAttachmentRow[]> => {
  const pool = await poolPromise

  const result = await pool
    .request()
    .input('AccountID', sql.Int, accountId)
    .input('VerificationRecordID', sql.Int, verificationRecordId)
    .query(`
      SELECT vra.VerificationRecordID AS verificationRecordId, vra.AttachmentID AS attachmentId
      FROM VerificationRecordAttachments vra
      INNER JOIN VerificationRecords vr ON vr.VerificationRecordID = vra.VerificationRecordID
      WHERE vra.VerificationRecordID = @VerificationRecordID AND vr.AccountID = @AccountID
    `)

  return result.recordset as VerificationRecordAttachmentRow[]
}

export const listActiveVerificationRecordTypes = async (): Promise<VerificationRecordTypeRow[]> => {
  const pool = await poolPromise

  const result = await pool.request().query(`
    SELECT VerificationTypeID AS verificationTypeId,
           Code AS code,
           Name AS name,
           Status AS status
    FROM VerificationRecordTypes
    WHERE Status = N'Active'
    ORDER BY VerificationTypeID ASC
  `)

  return result.recordset as VerificationRecordTypeRow[]
}

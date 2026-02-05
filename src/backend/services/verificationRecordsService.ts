// src/backend/services/verificationRecordsService.ts
import {
  listVerificationRecordsForAccount,
  getVerificationRecordById,
  listVerificationRecordsForSheet,
  createVerificationRecord,
  linkVerificationRecordToSheet,
  unlinkVerificationRecordFromSheet,
  attachEvidenceToVerificationRecord,
  listVerificationRecordAttachments,
  listActiveVerificationRecordTypes,
  type VerificationRecordRow,
  type VerificationRecordLinkRow,
  type VerificationRecordAttachmentRow,
  type VerificationRecordTypeRow,
} from '../repositories/verificationRecordsRepository'
import { sheetBelongsToAccount } from './sheetAccessService'
import { AppError } from '../errors/AppError'
import type { CreateVerificationRecordDto } from '@/domain/verification/verificationTypes'

export const listForAccount = async (
  accountId: number,
  opts?: { limit?: number; offset?: number }
): Promise<VerificationRecordRow[]> => {
  return listVerificationRecordsForAccount(accountId, opts)
}

export const getById = async (
  accountId: number,
  verificationRecordId: number
): Promise<VerificationRecordRow | null> => {
  return getVerificationRecordById(accountId, verificationRecordId)
}

export const listForSheet = async (
  accountId: number,
  sheetId: number
): Promise<VerificationRecordRow[]> => {
  const belongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!belongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }
  return listVerificationRecordsForSheet(accountId, sheetId)
}

export const create = async (
  accountId: number,
  input: CreateVerificationRecordDto
): Promise<VerificationRecordRow> => {
  return createVerificationRecord(accountId, input)
}

export const linkToSheet = async (
  accountId: number,
  verificationRecordId: number,
  sheetId: number
): Promise<VerificationRecordLinkRow> => {
  const sheetBelongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!sheetBelongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }

  const record = await getVerificationRecordById(accountId, verificationRecordId)
  if (!record) {
    throw new AppError('Verification record not found', 404)
  }

  return linkVerificationRecordToSheet(accountId, verificationRecordId, sheetId)
}

export const unlinkFromSheet = async (
  accountId: number,
  verificationRecordId: number,
  sheetId: number
): Promise<boolean> => {
  const sheetBelongs = await sheetBelongsToAccount(sheetId, accountId)
  if (!sheetBelongs) {
    throw new AppError('Sheet not found or does not belong to account', 404)
  }

  return unlinkVerificationRecordFromSheet(accountId, verificationRecordId, sheetId)
}

export const attachEvidence = async (
  accountId: number,
  verificationRecordId: number,
  attachmentId: number
): Promise<VerificationRecordAttachmentRow> => {
  const record = await getVerificationRecordById(accountId, verificationRecordId)
  if (!record) {
    throw new AppError('Verification record not found', 404)
  }

  const attachment = await attachEvidenceToVerificationRecord(accountId, verificationRecordId, attachmentId)
  if (!attachment) {
    throw new AppError('Failed to attach evidence: verification record not found or account mismatch', 404)
  }

  return attachment
}

export const listAttachments = async (
  accountId: number,
  verificationRecordId: number
): Promise<VerificationRecordAttachmentRow[]> => {
  const record = await getVerificationRecordById(accountId, verificationRecordId)
  if (!record) {
    throw new AppError('Verification record not found', 404)
  }

  return listVerificationRecordAttachments(accountId, verificationRecordId)
}

export const listActiveTypes = async (): Promise<VerificationRecordTypeRow[]> => {
  return listActiveVerificationRecordTypes()
}

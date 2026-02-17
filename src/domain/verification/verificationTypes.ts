// src/domain/verification/verificationTypes.ts

// Core VerificationRecord entity matching DB schema
export interface VerificationRecord {
  accountId: number              // NOT NULL, FK to Accounts
  verificationRecordId: number   // PK: VerificationRecordID
  issuerPartyId?: number         // Optional FK to Parties (if exists)
  createdAt?: string             // Optional ISO timestamp (if column exists)
  updatedAt?: string             // Optional ISO timestamp (if column exists)
}

// Link table: connects VerificationRecords to Sheets
export interface VerificationRecordLink {
  accountId: number              // NOT NULL, must match VerificationRecord.accountId
  verificationRecordId: number  // NOT NULL, FK to VerificationRecords
  sheetId: number | null        // Nullable FK to Sheets
}

// Attachment link table: connects VerificationRecords to Attachments
export interface VerificationRecordAttachment {
  verificationRecordId: number   // NOT NULL, part of composite PK
  attachmentId: number          // NOT NULL, part of composite PK
}

// DTOs for API/UI consumption

// Minimal representation for list views
export interface VerificationRecordListItemDto {
  verificationRecordId: number
  accountId: number
  issuerPartyId?: number
  createdAt?: string
  updatedAt?: string
}

// Payload for creating a new verification record
export interface CreateVerificationRecordDto {
  accountId: number              // Required
  verificationTypeId: number     // Required: FK to VerificationRecordTypes
  result?: 'PASS' | 'FAIL' | 'CONDITIONAL'  // Optional: only when Status is FINAL
  issuerPartyId?: number         // Optional
}

// Payload for linking a verification record to a sheet
export interface LinkVerificationRecordToSheetDto {
  verificationRecordId: number   // Required
  sheetId: number               // Required
}

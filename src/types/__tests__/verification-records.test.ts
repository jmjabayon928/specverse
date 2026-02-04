// src/types/__tests__/verification-records.test.ts

import {
  VerificationRecord,
  VerificationRecordLink,
  VerificationRecordAttachment,
  VerificationRecordListItemDto,
  CreateVerificationRecordDto,
  LinkVerificationRecordToSheetDto,
} from '@/domain/verification/verificationTypes'

describe('VerificationRecords types', () => {
  it('should export all expected types', () => {
    // Smoke test: verify types can be imported and used
    const record: VerificationRecord = {
      accountId: 1,
      verificationRecordId: 100,
      issuerPartyId: 5,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }

    expect(record.accountId).toBe(1)
    expect(record.verificationRecordId).toBe(100)
  })

  it('should allow minimal VerificationRecord without optional fields', () => {
    const minimalRecord: VerificationRecord = {
      accountId: 1,
      verificationRecordId: 100,
    }

    expect(minimalRecord.accountId).toBe(1)
  })

  it('should allow VerificationRecordLink with nullable sheetId', () => {
    const link: VerificationRecordLink = {
      accountId: 1,
      verificationRecordId: 100,
      sheetId: null,
    }

    expect(link.sheetId).toBeNull()
  })

  it('should allow VerificationRecordAttachment', () => {
    const attachment: VerificationRecordAttachment = {
      verificationRecordId: 100,
      attachmentId: 200,
    }

    expect(attachment.verificationRecordId).toBe(100)
    expect(attachment.attachmentId).toBe(200)
  })

  it('should allow DTOs', () => {
    const listItem: VerificationRecordListItemDto = {
      verificationRecordId: 100,
      accountId: 1,
    }

    const createDto: CreateVerificationRecordDto = {
      accountId: 1,
    }

    const linkDto: LinkVerificationRecordToSheetDto = {
      verificationRecordId: 100,
      sheetId: 50,
    }

    expect(listItem.verificationRecordId).toBe(100)
    expect(createDto.accountId).toBe(1)
    expect(linkDto.sheetId).toBe(50)
  })
})

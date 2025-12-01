// tests/schemas/filledVerifySchema.test.ts
import { ZodError } from 'zod'
import { verifyFilledSheetBodySchema } from '../../src/validation/datasheetVerifySchema'

describe('verifyFilledSheetBodySchema', () => {
  it('accepts action=verify without rejectionComment', () => {
    const input = {
      action: 'verify',
      rejectionComment: '',
    }

    const result = verifyFilledSheetBodySchema.parse(input)

    expect(result.action).toBe('verify')
    expect(result.rejectionComment).toBe('')
  })

  it('accepts action=reject when rejectionComment is non-empty', () => {
    const input = {
      action: 'reject',
      rejectionComment: 'Values do not match process conditions',
    }

    const result = verifyFilledSheetBodySchema.parse(input)

    expect(result.action).toBe('reject')
    expect(result.rejectionComment).toBe(
      'Values do not match process conditions'
    )
  })

  it('rejects action=reject when rejectionComment is missing or empty', () => {
    const emptyComment = {
      action: 'reject',
      rejectionComment: '',
    }

    const missingComment = {
      action: 'reject',
    }

    expect(() => verifyFilledSheetBodySchema.parse(emptyComment)).toThrow(
      ZodError
    )
    expect(() => verifyFilledSheetBodySchema.parse(missingComment)).toThrow(
      ZodError
    )
  })

  it('rejects unsupported action values', () => {
    const input = {
      action: 'approve',
      rejectionComment: '',
    }

    expect(() => verifyFilledSheetBodySchema.parse(input)).toThrow(ZodError)
  })
})

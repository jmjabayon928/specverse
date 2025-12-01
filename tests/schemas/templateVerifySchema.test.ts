// tests/schemas/templateVerifySchema.test.ts
import { ZodError } from 'zod'
import { verifyTemplateBodySchema } from '../../src/validation/datasheetVerifySchema'

describe('verifyTemplateBodySchema', () => {
  it('accepts action=verify without rejectionComment', () => {
    const input = {
      action: 'verify',
      rejectionComment: '',
    }

    const result = verifyTemplateBodySchema.parse(input)

    expect(result.action).toBe('verify')
    expect(result.rejectionComment).toBe('')
  })

  it('accepts action=reject when rejectionComment is non-empty', () => {
    const input = {
      action: 'reject',
      rejectionComment: 'Insufficient mechanical details',
    }

    const result = verifyTemplateBodySchema.parse(input)

    expect(result.action).toBe('reject')
    expect(result.rejectionComment).toBe('Insufficient mechanical details')
  })

  it('rejects action=reject when rejectionComment is missing or empty', () => {
    const emptyComment = {
      action: 'reject',
      rejectionComment: '',
    }

    const missingComment = {
      action: 'reject',
    }

    expect(() => verifyTemplateBodySchema.parse(emptyComment)).toThrow(ZodError)
    expect(() => verifyTemplateBodySchema.parse(missingComment)).toThrow(
      ZodError
    )
  })

  it('rejects unsupported action values', () => {
    const input = {
      action: 'approve',
      rejectionComment: '',
    }

    expect(() => verifyTemplateBodySchema.parse(input)).toThrow(ZodError)
  })
})

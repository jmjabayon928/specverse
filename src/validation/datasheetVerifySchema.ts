// src/validation/datasheetVerifySchema.ts
import { z } from 'zod'

export const verifyActionEnum = z.enum(['verify', 'reject'])

export const verifyTemplateBodySchema = z
  .object({
    action: verifyActionEnum,
    rejectionComment: z.string().optional(),
  })
  .superRefine((body, ctx) => {
    const isReject = body.action === 'reject'
    const hasComment =
      typeof body.rejectionComment === 'string' &&
      body.rejectionComment.trim().length > 0

    if (isReject && !hasComment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionComment'],
        message: 'Rejection comment is required when rejecting a template',
      })
    }
  })

export type VerifyTemplateBody = z.infer<typeof verifyTemplateBodySchema>

export const verifyFilledSheetBodySchema = z
  .object({
    action: verifyActionEnum,
    rejectionComment: z.string().optional(),
  })
  .superRefine((body, ctx) => {
    const isReject = body.action === 'reject'
    const hasComment =
      typeof body.rejectionComment === 'string' &&
      body.rejectionComment.trim().length > 0

    if (isReject && !hasComment) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionComment'],
        message: 'Rejection comment is required when rejecting a filled sheet',
      })
    }
  })

export type VerifyFilledSheetBody = z.infer<typeof verifyFilledSheetBodySchema>

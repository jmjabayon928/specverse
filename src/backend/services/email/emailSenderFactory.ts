// src/backend/services/email/emailSenderFactory.ts
import type { IEmailSender } from './emailSender.types'
import { devEmailSender } from './devEmailSender'
import { mailgunEmailSender } from './mailgunEmailSender'
import { resendEmailSender } from './resendEmailSender'

/**
 * Returns the email sender for the current environment.
 * Tests can mock this module to inject a stub sender.
 */
export function getEmailSender(): IEmailSender {
  const provider = process.env.EMAIL_PROVIDER

  if (process.env.NODE_ENV === 'development') {
    return devEmailSender
  }

  if (provider === 'resend') {
    return resendEmailSender
  }

  if (provider === 'mailgun') {
    return mailgunEmailSender
  }

  throw new Error(
    `Unsupported EMAIL_PROVIDER: ${provider ?? 'undefined'}`
  )
}
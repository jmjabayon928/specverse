// src/backend/services/email/emailSenderFactory.ts
import type { IEmailSender } from './emailSender.types'
import { devEmailSender } from './devEmailSender'
import { mailgunEmailSender } from './mailgunEmailSender'

/**
 * Returns the email sender for the current environment.
 * Tests can mock this module to inject a stub sender.
 */
export function getEmailSender(): IEmailSender {
  if (process.env.NODE_ENV === 'development') {
    return devEmailSender
  }
  return mailgunEmailSender
}

// src/backend/services/email/mailgunEmailSender.ts
import type { IEmailSender, SendInviteEmailParams } from './emailSender.types'
import { AppError } from '../../errors/AppError'

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN
const MAILGUN_FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL

function ensureMailgunConfig(): void {
  if (typeof MAILGUN_API_KEY === 'string' && MAILGUN_API_KEY.length > 0 &&
      typeof MAILGUN_DOMAIN === 'string' && MAILGUN_DOMAIN.length > 0 &&
      typeof MAILGUN_FROM_EMAIL === 'string' && MAILGUN_FROM_EMAIL.length > 0) {
    return
  }
  throw new AppError(
    'Mailgun is not configured: set MAILGUN_API_KEY, MAILGUN_DOMAIN, and MAILGUN_FROM_EMAIL',
    500,
  )
}

/**
 * Mailgun sender: sends invite email via Mailgun API. Validates env in production/staging.
 */
export const mailgunEmailSender: IEmailSender = {
  async sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
    ensureMailgunConfig()

    const subject = `You're invited to join ${params.accountName} on SpecVerse`
    const inviterLine = params.inviterName
      ? `${params.inviterName} has invited you to join ${params.accountName}.`
      : `You have been invited to join ${params.accountName}.`
    const body = `${inviterLine}\n\nAccept your invite by visiting:\n${params.inviteAcceptLink}\n\nThis link will expire in 7 days.`

    const form = new URLSearchParams()
    form.set('from', MAILGUN_FROM_EMAIL as string)
    form.set('to', params.to)
    form.set('subject', subject)
    form.set('text', body)

    const response = await fetch(
      `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
    )

    if (response.ok) {
      return
    }
    const text = await response.text()
    throw new AppError(
      `Mailgun send failed: ${response.status} ${text.slice(0, 200)}`,
      response.status >= 500 ? response.status : 502,
    )
  },
}

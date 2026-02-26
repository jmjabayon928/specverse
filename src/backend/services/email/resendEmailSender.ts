import { Resend } from 'resend'
import type { IEmailSender, SendInviteEmailParams } from './emailSender.types'
import { AppError } from '../../errors/AppError'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL

function ensureResendConfig(): void {
  if (
    typeof RESEND_API_KEY === 'string' &&
    RESEND_API_KEY.length > 0 &&
    typeof RESEND_FROM_EMAIL === 'string' &&
    RESEND_FROM_EMAIL.length > 0
  ) {
    return
  }

  throw new AppError(
    'Resend is not configured: set RESEND_API_KEY and RESEND_FROM_EMAIL',
    500
  )
}

export const resendEmailSender: IEmailSender = {
  async sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
    ensureResendConfig()

    const resend = new Resend(RESEND_API_KEY)

    const subject = `You're invited to join ${params.accountName} on SpecVerse`
    const inviterLine = params.inviterName
      ? `${params.inviterName} has invited you to join ${params.accountName}.`
      : `You have been invited to join ${params.accountName}.`

    const html = `
      <p>${inviterLine}</p>
      <p>
        Accept your invite by visiting:<br/>
        <a href="${params.inviteAcceptLink}">
          ${params.inviteAcceptLink}
        </a>
      </p>
      <p>This link will expire in 7 days.</p>
    `

    const { error } = await resend.emails.send({
      from: RESEND_FROM_EMAIL as string,
      to: params.to,
      subject,
      html
    })

    if (error) {
      throw new AppError(
        `Resend send failed: ${error.message}`,
        502
      )
    }
  }
}
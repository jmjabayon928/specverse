// src/backend/services/email/devEmailSender.ts
import type { IEmailSender, SendInviteEmailParams } from './emailSender.types'
import { redactInviteUrl } from '../../utils/redact'

/**
 * Dev sender: logs a redacted summary (no token in logs). No real email sent.
 */
export const devEmailSender: IEmailSender = {
  async sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
    console.log('[DevEmail] Invite:', {
      to: params.to,
      accountName: params.accountName,
      inviterName: params.inviterName,
      acceptUrl: redactInviteUrl(params.inviteAcceptLink),
    })
  },
}

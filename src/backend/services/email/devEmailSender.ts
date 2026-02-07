// src/backend/services/email/devEmailSender.ts
import type { IEmailSender, SendInviteEmailParams } from './emailSender.types'

/**
 * Dev sender: logs the accept URL so developers can copy it. No real email sent.
 */
export const devEmailSender: IEmailSender = {
  async sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
    console.log('[DevEmail] Invite:', {
      to: params.to,
      accountName: params.accountName,
      inviterName: params.inviterName,
      acceptUrl: params.inviteAcceptLink,
    })
  },
}

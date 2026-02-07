// src/backend/services/email/emailSender.types.ts

export interface SendInviteEmailParams {
  to: string
  inviteAcceptLink: string
  accountName: string
  inviterName?: string
}

/**
 * Abstraction for sending invite emails. Dev implementation logs the accept URL.
 */
export interface IEmailSender {
  sendInviteEmail(params: SendInviteEmailParams): Promise<void>
}

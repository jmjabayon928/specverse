// tests/services/invitesService.list.test.ts
import type { Request, Response, NextFunction } from 'express'

jest.mock('../../src/backend/repositories/invitesRepository', () => {
  return {
    listByAccount: jest.fn(),
    findByTokenHash: jest.fn(),
  }
})

import { computeResolvedInviteStatus, getByToken, listInvites } from '../../src/backend/services/invitesService'

const { listByAccount, findByTokenHash } = jest.requireMock('../../src/backend/repositories/invitesRepository') as {
  listByAccount: jest.Mock
  findByTokenHash: jest.Mock
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  const now = new Date()
  return {
    inviteId: 1,
    accountId: 10,
    email: 'user@example.com',
    roleId: 2,
    tokenHash: 'x'.repeat(64),
    status: 'Pending',
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    invitedByUserId: 99,
    createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    acceptedByUserId: null,
    acceptedAt: null,
    revokedByUserId: null,
    revokedAt: null,
    sendCount: 1,
    lastSentAt: null,
    accountName: 'Acme',
    inviterName: 'Inviter',
    roleName: 'Member',
    ...overrides,
  }
}

describe('invitesService.listInvites', () => {
  beforeEach(() => {
    listByAccount.mockReset()
    findByTokenHash.mockReset()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-02-07T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('scope=pending returns pending rows and resolvedStatus=Expired when ExpiresAt < now', async () => {
    listByAccount.mockResolvedValueOnce([
      makeRow({
        inviteId: 1,
        status: 'Pending',
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
      makeRow({
        inviteId: 2,
        status: 'Pending',
        expiresAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    ])

    const invites = await listInvites(10, 'pending')

    expect(listByAccount).toHaveBeenCalledWith(10, 'pending')
    expect(invites).toHaveLength(2)
    expect(invites[0]?.status).toBe('Pending')
    expect(invites[0]?.resolvedStatus).toBe('Expired')
    expect(invites[1]?.status).toBe('Pending')
    expect(invites[1]?.resolvedStatus).toBe('Pending')
  })

  it('scope=all returns all statuses and resolves only pending-expired to Expired', async () => {
    listByAccount.mockResolvedValueOnce([
      makeRow({
        inviteId: 1,
        status: 'Accepted',
        expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      makeRow({
        inviteId: 2,
        status: 'Declined',
        expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      makeRow({
        inviteId: 3,
        status: 'Revoked',
        expiresAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      makeRow({
        inviteId: 4,
        status: 'Pending',
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ])

    const invites = await listInvites(10, 'all')

    expect(listByAccount).toHaveBeenCalledWith(10, 'all')
    expect(invites.map(i => i.resolvedStatus)).toEqual([
      'Accepted',
      'Declined',
      'Revoked',
      'Expired',
    ])
  })
})

describe('invitesService.computeResolvedInviteStatus', () => {
  it('treats a pending invite as Expired iff ExpiresAt < now (strict <)', () => {
    const now = new Date('2026-02-07T12:00:00.000Z')
    const expired = computeResolvedInviteStatus({ status: 'Pending', expiresAt: new Date('2026-02-07T11:59:59.999Z') }, now)
    const stillValid = computeResolvedInviteStatus({ status: 'Pending', expiresAt: new Date('2026-02-07T12:00:00.000Z') }, now)

    expect(expired).toBe('Expired')
    expect(stillValid).toBe('Pending')
  })
})

describe('invitesService.getByToken status mapping', () => {
  beforeEach(() => {
    listByAccount.mockReset()
    findByTokenHash.mockReset()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-02-07T12:00:00.000Z'))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('maps canonical resolved status to lowercase public status', async () => {
    findByTokenHash.mockResolvedValueOnce(
      makeRow({
        status: 'Pending',
        expiresAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    )

    const result = await getByToken('plain-token')

    expect(result).not.toBeNull()
    expect(result?.status).toBe('expired')
  })

  it('returns accepted/revoked/declined for non-pending statuses (no expiry check)', async () => {
    findByTokenHash.mockResolvedValueOnce(makeRow({ status: 'Accepted', expiresAt: new Date('2026-01-01T00:00:00.000Z') }))
    const accepted = await getByToken('t1')
    expect(accepted?.status).toBe('accepted')

    findByTokenHash.mockResolvedValueOnce(makeRow({ status: 'Revoked', expiresAt: new Date('2026-01-01T00:00:00.000Z') }))
    const revoked = await getByToken('t2')
    expect(revoked?.status).toBe('revoked')

    findByTokenHash.mockResolvedValueOnce(makeRow({ status: 'Declined', expiresAt: new Date('2026-01-01T00:00:00.000Z') }))
    const declined = await getByToken('t3')
    expect(declined?.status).toBe('declined')
  })
})

describe('invitesController.list', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('invalid scope => 400', async () => {
    jest.doMock('../../src/backend/services/invitesService', () => ({
      listInvites: jest.fn(),
    }))

    // Import after mocking.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const controller = require('../../src/backend/controllers/invitesController') as {
      list: (req: Request, res: Response, next: NextFunction) => Promise<void>
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const svc = require('../../src/backend/services/invitesService') as { listInvites: jest.Mock }

    const req = {
      user: { accountId: 10 },
      query: { scope: 'nope' },
    } as unknown as Request

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response

    const next = jest.fn() as unknown as NextFunction

    await controller.list(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid scope. Expected 'pending' or 'all'." })
    expect(svc.listInvites).not.toHaveBeenCalled()
  })
})


/**
 * Audit completeness for AccountMembers lifecycle actions.
 *
 * Required audits:
 * - PATCH /api/backend/account-members/:id/role => member.role_changed
 * - PATCH /api/backend/account-members/:id/status => member.deactivated / member.reactivated
 */
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { PERMISSIONS } from '../../src/constants/permissions'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'secret'

jest.mock('../../src/backend/middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../src/backend/middleware/authMiddleware')
  const { createAuthMiddlewareMock } = jest.requireActual('../helpers/authMiddlewareMock')
  return createAuthMiddlewareMock({ actual, mode: 'token' })
})

type AuditLogEntry = {
  TableName?: string | null
  RecordID?: number | null
  Action: string
  PerformedBy: number
  Route?: string | null
  Method?: string | null
  StatusCode?: number | null
  Changes?: string | null
}

const insertAuditLogMock = jest.fn<Promise<void>, [AuditLogEntry]>().mockResolvedValue(undefined)

jest.mock('../../src/backend/database/auditQueries', () => ({
  insertAuditLog: (entry: AuditLogEntry) => insertAuditLogMock(entry),
  getAllAuditLogs: jest.fn(),
  getAllAuditLogsCount: jest.fn(),
  getAuditLogsForRecord: jest.fn(),
}))

const checkUserPermission = jest.fn().mockResolvedValue(true)

const listMembersRepo = jest.fn().mockResolvedValue([])
const getMemberInAccount = jest.fn().mockResolvedValue(null)
const countActiveAdminsInAccount = jest.fn().mockResolvedValue(2)
const countActiveOwnersInAccount = jest.fn().mockResolvedValue(1)
const updateMemberRoleRepo = jest.fn().mockResolvedValue(undefined)
const updateMemberStatusRepo = jest.fn().mockResolvedValue(undefined)


jest.mock('../../src/backend/database/permissionQueries', () => ({
  checkUserPermission: (...args: unknown[]) => checkUserPermission(...args),
}))

jest.mock('../../src/backend/repositories/accountMembersRepository', () => ({
  listMembers: (...args: unknown[]) => listMembersRepo(...args),
  getMemberInAccount: (...args: unknown[]) => getMemberInAccount(...args),
  countActiveAdminsInAccount: (...args: unknown[]) => countActiveAdminsInAccount(...args),
  countActiveOwnersInAccount: (...args: unknown[]) => countActiveOwnersInAccount(...args),
  updateMemberRole: (...args: unknown[]) => updateMemberRoleRepo(...args),
  updateMemberStatus: (...args: unknown[]) => updateMemberStatusRepo(...args),
}))

import app from '../../src/backend/app'

function makeToken(payload: { userId: number; accountId?: number; roleId?: number; role?: string; permissions?: string[] }): string {
  return jwt.sign(
    {
      userId: payload.userId,
      accountId: payload.accountId ?? 1,
      roleId: payload.roleId ?? 1,
      role: payload.role ?? 'Admin',
      email: 'admin@example.com',
      permissions: payload.permissions ?? [PERMISSIONS.ACCOUNT_ROLE_MANAGE, PERMISSIONS.ACCOUNT_USER_MANAGE],
    },
    process.env.JWT_SECRET ?? 'secret',
    { expiresIn: '1h' }
  )
}

const sampleMember = {
  accountMemberId: 10,
  userId: 2,
  email: 'member@example.com',
  firstName: 'Member',
  lastName: 'User',
  roleId: 2,
  roleName: 'Engineer',
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
}

beforeEach(() => {
  jest.clearAllMocks()
  checkUserPermission.mockResolvedValue(true)
  countActiveAdminsInAccount.mockResolvedValue(2)
  countActiveOwnersInAccount.mockResolvedValue(1)
})

describe('AccountMembers audits', () => {
  it('logs member.role_changed on PATCH /account-members/:id/role when role changes', async () => {
    getMemberInAccount
      .mockResolvedValueOnce({ ...sampleMember, roleId: 2, roleName: 'Engineer' })
      .mockResolvedValueOnce({ ...sampleMember, roleId: 1, roleName: 'Admin' })

    const token = makeToken({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: [PERMISSIONS.ACCOUNT_ROLE_MANAGE, PERMISSIONS.ACCOUNT_USER_MANAGE],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/role')
      .set('Cookie', [`token=${token}`])
      .send({ roleId: 1 })

    expect(res.status).toBe(200)

    expect(insertAuditLogMock).toHaveBeenCalledTimes(1)
    const entry = insertAuditLogMock.mock.calls[0]?.[0]
    expect(entry).toBeDefined()
    expect(entry).toMatchObject({
      TableName: 'AccountMembers',
      RecordID: 10,
      Action: 'member.role_changed',
      PerformedBy: 1,
      Method: 'PATCH',
      StatusCode: 200,
    })
    expect(entry?.Route).toContain('/api/backend/account-members/10/role')
    expect(entry?.Changes).toBe(JSON.stringify({ targetUserId: 2, fromRoleId: 2, toRoleId: 1 }))
  })

  it('logs member.deactivated on PATCH /account-members/:id/status when isActive true -> false', async () => {
    getMemberInAccount
      .mockResolvedValueOnce({ ...sampleMember, isActive: true, roleName: 'Engineer' })
      .mockResolvedValueOnce({ ...sampleMember, isActive: false, roleName: 'Engineer' })

    const token = makeToken({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: [PERMISSIONS.ACCOUNT_ROLE_MANAGE, PERMISSIONS.ACCOUNT_USER_MANAGE],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: false })

    expect(res.status).toBe(200)

    expect(insertAuditLogMock).toHaveBeenCalledTimes(1)
    const entry = insertAuditLogMock.mock.calls[0]?.[0]
    expect(entry).toBeDefined()
    expect(entry).toMatchObject({
      TableName: 'AccountMembers',
      RecordID: 10,
      Action: 'member.deactivated',
      PerformedBy: 1,
      Method: 'PATCH',
      StatusCode: 200,
    })
    expect(entry?.Route).toContain('/api/backend/account-members/10/status')
    expect(entry?.Changes).toBe(JSON.stringify({ targetUserId: 2, fromIsActive: true, toIsActive: false }))
  })

  it('logs member.reactivated on PATCH /account-members/:id/status when isActive false -> true', async () => {
    getMemberInAccount
      .mockResolvedValueOnce({ ...sampleMember, isActive: false, roleName: 'Engineer' })
      .mockResolvedValueOnce({ ...sampleMember, isActive: true, roleName: 'Engineer' })

    const token = makeToken({
      userId: 1,
      accountId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: [PERMISSIONS.ACCOUNT_ROLE_MANAGE, PERMISSIONS.ACCOUNT_USER_MANAGE],
    })

    const res = await request(app)
      .patch('/api/backend/account-members/10/status')
      .set('Cookie', [`token=${token}`])
      .send({ isActive: true })

    expect(res.status).toBe(200)

    expect(insertAuditLogMock).toHaveBeenCalledTimes(1)
    const entry = insertAuditLogMock.mock.calls[0]?.[0]
    expect(entry).toBeDefined()
    expect(entry).toMatchObject({
      TableName: 'AccountMembers',
      RecordID: 10,
      Action: 'member.reactivated',
      PerformedBy: 1,
      Method: 'PATCH',
      StatusCode: 200,
    })
    expect(entry?.Route).toContain('/api/backend/account-members/10/status')
    expect(entry?.Changes).toBe(JSON.stringify({ targetUserId: 2, fromIsActive: false, toIsActive: true }))
  })
})


// tests/utils/approveGating.test.ts
// Supervisor must not see Approve UI; Admin/others with DATASHEET_APPROVE may.

import { canSeeApproveUI } from '../../src/utils/approveGating'
import type { UserSession } from '../../src/domain/auth/sessionTypes'

describe('canSeeApproveUI', () => {
  it('returns false for Supervisor even with DATASHEET_APPROVE', () => {
    const user: UserSession = {
      userId: 1,
      roleId: 2,
      role: 'Supervisor',
      permissions: ['DATASHEET_APPROVE', 'DATASHEET_VERIFY'],
    }
    expect(canSeeApproveUI(user)).toBe(false)
  })

  it('returns true for Admin with DATASHEET_APPROVE', () => {
    const user: UserSession = {
      userId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: ['DATASHEET_APPROVE'],
    }
    expect(canSeeApproveUI(user)).toBe(true)
  })

  it('returns true for Engineer with DATASHEET_APPROVE', () => {
    const user: UserSession = {
      userId: 1,
      roleId: 2,
      role: 'Engineer',
      permissions: ['DATASHEET_APPROVE', 'DATASHEET_EDIT'],
    }
    expect(canSeeApproveUI(user)).toBe(true)
  })

  it('returns false when user has no DATASHEET_APPROVE', () => {
    const user: UserSession = {
      userId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: ['DATASHEET_VERIFY'],
    }
    expect(canSeeApproveUI(user)).toBe(false)
  })

  it('returns false for null-like user', () => {
    expect(canSeeApproveUI({} as UserSession)).toBe(false)
  })

  it('returns false when permissions is not an array', () => {
    const user = {
      userId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: null,
    } as unknown as UserSession
    expect(canSeeApproveUI(user)).toBe(false)
  })
})

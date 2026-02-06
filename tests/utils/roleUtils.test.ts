/**
 * Unit tests for centralized Admin role identification (Phase 2.5 hardening).
 */
import { isAdminRole, ADMIN_ROLE_NAME_NORMALIZED } from '../../src/backend/utils/roleUtils'

describe('roleUtils', () => {
  it('exports normalized admin name as lowercase', () => {
    expect(ADMIN_ROLE_NAME_NORMALIZED).toBe('admin')
  })

  it('isAdminRole returns true for "admin" case-insensitive and trimmed', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('Admin')).toBe(true)
    expect(isAdminRole('ADMIN')).toBe(true)
    expect(isAdminRole('  admin  ')).toBe(true)
  })

  it('isAdminRole returns false for non-admin roles', () => {
    expect(isAdminRole('Engineer')).toBe(false)
    expect(isAdminRole('Viewer')).toBe(false)
    expect(isAdminRole('administrator')).toBe(false)
    expect(isAdminRole('')).toBe(false)
  })
})

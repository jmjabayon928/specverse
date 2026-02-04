// tests/constants/permissions.test.ts
// Ensures canonical permission keys used by routes and frontend exist in PERMISSIONS.

import { PERMISSIONS } from '../../src/constants/permissions'

const ROUTE_AND_UI_KEYS = [
  'DATASHEET_VIEW',
  'DATASHEET_EDIT',
  'DATASHEET_CREATE',
  'DATASHEET_VERIFY',
  'DATASHEET_APPROVE',
  'DATASHEET_NOTE_EDIT',
  'DATASHEET_ATTACHMENT_UPLOAD',
  'DATASHEET_ATTACHMENT_DELETE',
  'DATASHEET_EXPORT',
  'DASHBOARD_VIEW',
  'INVENTORY_VIEW',
  'INVENTORY_CREATE',
  'INVENTORY_EDIT',
  'INVENTORY_DELETE',
  'INVENTORY_MAINTENANCE_VIEW',
  'INVENTORY_MAINTENANCE_CREATE',
  'INVENTORY_TRANSACTION_CREATE',
] as const

describe('PERMISSIONS (canonical keys)', () => {
  it('exposes all keys used by routes and SecurePage', () => {
    for (const key of ROUTE_AND_UI_KEYS) {
      expect(PERMISSIONS).toHaveProperty(key)
      expect(typeof (PERMISSIONS as Record<string, string>)[key]).toBe('string')
      expect((PERMISSIONS as Record<string, string>)[key]).toBe(key)
    }
  })

  it('values are stable (key name equals value)', () => {
    const perm = PERMISSIONS as Record<string, string>
    for (const [k, v] of Object.entries(perm)) {
      expect(v).toBe(k)
    }
  })
})

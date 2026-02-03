// tests/utils/auditEntityLink.test.ts
// Uses real action values from templateService, filledSheetService, and route auditAction middleware.

import {
  getAuditEntityLink,
  inferSheetKindFromAction,
} from '../../src/utils/auditEntityLink'

describe('inferSheetKindFromAction', () => {
  it('returns "template" for known template actions from templateService', () => {
    expect(inferSheetKindFromAction('Create Template')).toBe('template')
    expect(inferSheetKindFromAction('Verify Template')).toBe('template')
    expect(inferSheetKindFromAction('Reject Template')).toBe('template')
    expect(inferSheetKindFromAction('Approve Template')).toBe('template')
  })

  it('returns "template" for known template actions from templateRoutes (auditAction)', () => {
    expect(inferSheetKindFromAction('Update Template')).toBe('template')
    expect(inferSheetKindFromAction('Clone Template')).toBe('template')
    expect(inferSheetKindFromAction('Create Template Note')).toBe('template')
    expect(inferSheetKindFromAction('Update Template Note')).toBe('template')
    expect(inferSheetKindFromAction('Delete Template Note')).toBe('template')
    expect(inferSheetKindFromAction('Upload Template Attachment')).toBe('template')
    expect(inferSheetKindFromAction('Delete Template Attachment')).toBe('template')
    expect(inferSheetKindFromAction('Export Template PDF')).toBe('template')
    expect(inferSheetKindFromAction('Export Template Excel')).toBe('template')
  })

  it('returns "filled" for known filled-sheet actions from filledSheetService', () => {
    expect(inferSheetKindFromAction('Create Filled Sheet')).toBe('filled')
    expect(inferSheetKindFromAction('Verify Filled Sheet')).toBe('filled')
    expect(inferSheetKindFromAction('Reject Filled Sheet')).toBe('filled')
    expect(inferSheetKindFromAction('Approve Filled Sheet')).toBe('filled')
  })

  it('returns "filled" for known filled-sheet actions from filledSheetRoutes (auditAction)', () => {
    expect(inferSheetKindFromAction('Update Filled Sheet')).toBe('filled')
    expect(inferSheetKindFromAction('Clone Filled Sheet')).toBe('filled')
    expect(inferSheetKindFromAction('Restore Filled Sheet Revision')).toBe('filled')
    expect(inferSheetKindFromAction('Create Filled Sheet Note')).toBe('filled')
    expect(inferSheetKindFromAction('Update Filled Sheet Note')).toBe('filled')
    expect(inferSheetKindFromAction('Delete Filled Sheet Note')).toBe('filled')
    expect(inferSheetKindFromAction('Upload Filled Sheet Attachment')).toBe('filled')
    expect(inferSheetKindFromAction('Delete Filled Sheet Attachment')).toBe('filled')
  })

  it('defaults to "filled" when action is unknown or empty', () => {
    expect(inferSheetKindFromAction('')).toBe('filled')
    expect(inferSheetKindFromAction(null)).toBe('filled')
    expect(inferSheetKindFromAction(undefined)).toBe('filled')
    expect(inferSheetKindFromAction('Some Future Action')).toBe('filled')
    expect(inferSheetKindFromAction('Template')).toBe('filled') // substring not in allowlist
  })
})

describe('getAuditEntityLink', () => {
  it('returns null when entityId is missing or invalid', () => {
    expect(getAuditEntityLink('Sheets', null, 'Update Template')).toBeNull()
    expect(getAuditEntityLink('Sheets', 0, 'Update Template')).toBeNull()
    expect(getAuditEntityLink('Sheets', NaN, 'Update Template')).toBeNull()
  })

  it('returns template link for Sheets with known template action', () => {
    const link = getAuditEntityLink('Sheets', 42, 'Approve Template')
    expect(link).not.toBeNull()
    expect(link!.href).toBe('/datasheets/templates/42')
    expect(link!.label).toBe('View template')
  })

  it('returns filled sheet link for Sheets with known filled action', () => {
    const link = getAuditEntityLink('Sheets', 99, 'Update Filled Sheet')
    expect(link).not.toBeNull()
    expect(link!.href).toBe('/datasheets/filled/99')
    expect(link!.label).toBe('View filled sheet')
  })

  it('returns filled sheet link for Sheets when action is empty or unknown (default)', () => {
    expect(getAuditEntityLink('Sheets', 1, '')).not.toBeNull()
    expect(getAuditEntityLink('Sheets', 1, '')!.href).toBe('/datasheets/filled/1')
    expect(getAuditEntityLink('Sheets', 1, null)!.href).toBe('/datasheets/filled/1')
    expect(getAuditEntityLink('Sheets', 1, 'Unknown Action')!.href).toBe('/datasheets/filled/1')
  })

  it('returns users link when entityType is Users', () => {
    const link = getAuditEntityLink('Users', 5, null)
    expect(link).not.toBeNull()
    expect(link!.href).toBe('/settings/users')
    expect(link!.label).toBe('View users')
  })

  it('returns null for unknown entityType', () => {
    expect(getAuditEntityLink('UnknownTable', 1, null)).toBeNull()
    expect(getAuditEntityLink('', 1, null)).toBeNull()
  })
})

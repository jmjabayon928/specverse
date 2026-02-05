// tests/ui/datasheets/RevisionsListClient.test.tsx
// 4B: Revision list "changed fields" badge — client-side diff, badge shows correct count.

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RevisionsListClient from '../../../src/app/(admin)/datasheets/filled/[id]/revisions/RevisionsListClient'
import type { UnifiedSheet } from '../../../src/domain/datasheets/sheetTypes'
import { PERMISSIONS } from '../../../src/constants/permissions'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

/** Minimal valid UnifiedSheet for list/revision API snapshot shape (matches unifiedSheetSchema). */
function makeSnapshot(overrides: { revisionNum?: number; fieldValue?: string } = {}): UnifiedSheet {
  const { revisionNum = 1, fieldValue = '10' } = overrides
  return {
    sheetName: 'Test Sheet',
    sheetDesc: 'Test Desc',
    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,
    areaId: 1,
    packageName: 'Test Package',
    revisionNum,
    revisionDate: '2026-01-01',
    preparedById: 1,
    preparedByDate: '2026-01-01',
    itemLocation: 'Test Location',
    requiredQty: 1,
    equipmentName: 'Test Equipment',
    equipmentTagNum: 'TAG-001',
    serviceName: 'Test Service',
    manuId: 1,
    suppId: 1,
    equipSize: 1,
    categoryId: 1,
    clientId: 1,
    projectId: 1,
    subsheets: [
      {
        id: 1,
        name: 'Main',
        fields: [
          {
            id: 1,
            originalId: 1,
            label: 'Design Pressure',
            infoType: 'decimal',
            uom: 'kPa',
            sortOrder: 1,
            required: true,
            value: fieldValue,
          },
        ],
      },
    ],
  }
}

const sheetId = 99
const rev1Id = 101
const rev2Id = 102
const listUrl = `/api/backend/filledsheets/${sheetId}/revisions?page=1&pageSize=20`
const rev1Url = `/api/backend/filledsheets/${sheetId}/revisions/${rev1Id}`
const rev2Url = `/api/backend/filledsheets/${sheetId}/revisions/${rev2Id}`

const listResponse = {
  page: 1,
  pageSize: 20,
  total: 2,
  rows: [
    { revisionId: rev2Id, revisionNumber: 2, createdAt: '2026-02-02T12:00:00Z', createdBy: 1, createdByName: 'User', status: null, comment: null },
    { revisionId: rev1Id, revisionNumber: 1, createdAt: '2026-02-01T12:00:00Z', createdBy: 1, createdByName: 'User', status: null, comment: null },
  ],
}

describe('RevisionsListClient', () => {
  const defaultProps = {
    sheetId,
    user: {
      userId: 1,
      roleId: 1,
      role: 'Admin',
      permissions: [PERMISSIONS.DATASHEET_VIEW],
    },
    defaultLanguage: 'eng',
    defaultUnitSystem: 'SI' as const,
    initialTranslations: null,
  }

  beforeEach(() => {
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('shows "Fields changed" badge with correct count for revision 2 vs 1 (4B)', async () => {
    const fetchMock = globalThis.fetch as jest.Mock
    const snapshot1 = makeSnapshot({ revisionNum: 1, fieldValue: '10' })
    const snapshot2 = makeSnapshot({ revisionNum: 2, fieldValue: '20' })

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => listResponse,
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...listResponse.rows.find(r => r.revisionId === rev2Id)!, snapshot: snapshot2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ...listResponse.rows.find(r => r.revisionId === rev1Id)!, snapshot: snapshot1 }) })

    render(<RevisionsListClient {...defaultProps} />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(listUrl, expect.any(Object))
    })

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c: [string]) => c[0])
      expect(calls).toContain(rev1Url)
      expect(calls).toContain(rev2Url)
    })

    await waitFor(() => {
      expect(screen.getByText('1 changed')).toBeInTheDocument()
    })

    expect(screen.getByText('Revision History')).toBeInTheDocument()
    const rev1Row = screen.getByText('1').closest('tr')
    expect(rev1Row).toBeTruthy()
    expect(rev1Row).toHaveTextContent('—')
  })
})

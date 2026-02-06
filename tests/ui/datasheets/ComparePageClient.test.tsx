// Phase 2 Slice #4: Compare page client – table rendering and variance PATCH.
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import ComparePageClient from '../../../src/app/(admin)/datasheets/filled/[id]/compare/ComparePageClient'
import type { CompareResponse, ValueSetListItem } from '../../../src/domain/datasheets/compareTypes'
import { PERMISSIONS } from '../../../src/constants/permissions'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

jest.mock('../../../src/hooks/useSession', () => ({
  useSession: jest.fn(),
}))

const useSessionMock = jest.requireMock('../../../src/hooks/useSession').useSession as jest.Mock

function mockCompareData(): CompareResponse {
  return {
    subsheets: [
      {
        id: 10,
        name: 'Main',
        fields: [
          {
            infoTemplateId: 101,
            label: 'Design Pressure',
            requirement: { value: '10', uom: 'kPa' },
            offered: [
              {
                partyId: 99,
                valueSetId: 2,
                value: '12',
                uom: 'kPa',
                varianceStatus: undefined,
              },
            ],
            asBuilt: { value: '11', uom: 'kPa', varianceStatus: undefined },
          },
          {
            infoTemplateId: 102,
            label: 'Design Temperature',
            requirement: { value: '100', uom: '°C' },
            offered: [],
            asBuilt: null,
          },
        ],
      },
    ],
  }
}

function mockValueSets(): ValueSetListItem[] {
  return [
    { ValueSetID: 1, SheetID: 1, ContextID: 1, Code: 'Requirement', PartyID: null, Status: 'Locked' },
    { ValueSetID: 2, SheetID: 1, ContextID: 2, Code: 'Offered', PartyID: 99, Status: 'Draft' },
    { ValueSetID: 3, SheetID: 1, ContextID: 3, Code: 'AsBuilt', PartyID: null, Status: 'Draft' },
  ]
}

describe('ComparePageClient', () => {
  const sheetId = 1
  const compareData = mockCompareData()
  const valueSets = mockValueSets()

  beforeEach(() => {
    useSessionMock.mockReturnValue({
      user: { userId: 1, roleId: 1, permissions: [PERMISSIONS.DATASHEET_VIEW, PERMISSIONS.DATASHEET_EDIT] },
      loading: false,
    })
  })

  it('renders compare table with headers and mock data', () => {
    render(
      <ComparePageClient
        sheetId={sheetId}
        compareData={compareData}
        valueSets={valueSets}
      />
    )

    expect(screen.getByText('Compare: Requirement vs Offered vs As-Built')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /field/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /requirement/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /offered/i })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /as-built/i })).toBeInTheDocument()

    expect(screen.getByText('Design Pressure')).toBeInTheDocument()
    expect(screen.getByText('Design Temperature')).toBeInTheDocument()
    expect(screen.getByText(/10\s+kPa/)).toBeInTheDocument()
    expect(screen.getByText(/12\s+kPa/)).toBeInTheDocument()
    expect(screen.getByText(/11\s+kPa/)).toBeInTheDocument()
    expect(screen.getByText(/100\s+°C/)).toBeInTheDocument()
  })

  it('shows Accepted badge when varianceStatus is DeviatesAccepted', () => {
    const dataWithAccepted: CompareResponse = {
      subsheets: [
        {
          id: 10,
          name: 'Main',
          fields: [
            {
              infoTemplateId: 101,
              label: 'Design Pressure',
              requirement: { value: '10', uom: null },
              offered: [
                {
                  partyId: 99,
                  valueSetId: 2,
                  value: '12',
                  uom: null,
                  varianceStatus: 'DeviatesAccepted',
                },
              ],
              asBuilt: null,
            },
          ],
        },
      ],
    }
    render(
      <ComparePageClient
        sheetId={sheetId}
        compareData={dataWithAccepted}
        valueSets={valueSets}
      />
    )
    expect(screen.getByText('Accepted')).toBeInTheDocument()
  })

  it('shows Rejected badge when varianceStatus is DeviatesRejected', () => {
    const dataWithRejected: CompareResponse = {
      subsheets: [
        {
          id: 10,
          name: 'Main',
          fields: [
            {
              infoTemplateId: 101,
              label: 'Design Pressure',
              requirement: { value: '10', uom: null },
              offered: [
                {
                  partyId: 99,
                  valueSetId: 2,
                  value: '12',
                  uom: null,
                  varianceStatus: 'DeviatesRejected',
                },
              ],
              asBuilt: null,
            },
          ],
        },
      ],
    }
    render(
      <ComparePageClient
        sheetId={sheetId}
        compareData={dataWithRejected}
        valueSets={valueSets}
      />
    )
    expect(screen.getByText('Rejected')).toBeInTheDocument()
  })

  it('calls PATCH variances with status DeviatesAccepted when clicking Accept', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    render(
      <ComparePageClient
        sheetId={sheetId}
        compareData={compareData}
        valueSets={valueSets}
      />
    )

    const acceptButtons = screen.getAllByRole('button', { name: /accept/i })
    fireEvent.click(acceptButtons[0])

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/backend/sheets/${sheetId}/valuesets/2/variances`,
        expect.objectContaining({
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ infoTemplateId: 101, status: 'DeviatesAccepted' }),
        })
      )
    })

    fetchSpy.mockRestore()
  })

  it('calls PATCH variances with status DeviatesRejected when clicking Reject', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    render(
      <ComparePageClient
        sheetId={sheetId}
        compareData={compareData}
        valueSets={valueSets}
      />
    )

    const rejectButtons = screen.getAllByRole('button', { name: /reject/i })
    fireEvent.click(rejectButtons[0])

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/backend/sheets/${sheetId}/valuesets/2/variances`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ infoTemplateId: 101, status: 'DeviatesRejected' }),
        })
      )
    })

    fetchSpy.mockRestore()
  })

  it('calls PATCH variances with status null when clicking Clear', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)

    render(
      <ComparePageClient
        sheetId={sheetId}
        compareData={compareData}
        valueSets={valueSets}
      />
    )

    const clearButtons = screen.getAllByRole('button', { name: /clear/i })
    fireEvent.click(clearButtons[0])

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        `/api/backend/sheets/${sheetId}/valuesets/2/variances`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ infoTemplateId: 101, status: null }),
        })
      )
    })

    fetchSpy.mockRestore()
  })

  it('does not show Accept/Reject/Clear when ValueSet status is Locked or Verified', () => {
    const lockedValueSets: ValueSetListItem[] = [
      { ValueSetID: 1, SheetID: 1, ContextID: 1, Code: 'Requirement', PartyID: null, Status: 'Locked' },
      { ValueSetID: 2, SheetID: 1, ContextID: 2, Code: 'Offered', PartyID: 99, Status: 'Locked' },
      { ValueSetID: 3, SheetID: 1, ContextID: 3, Code: 'AsBuilt', PartyID: null, Status: 'Verified' },
    ]
    render(
      <ComparePageClient
        sheetId={sheetId}
        compareData={compareData}
        valueSets={lockedValueSets}
      />
    )
    expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument()
  })
})

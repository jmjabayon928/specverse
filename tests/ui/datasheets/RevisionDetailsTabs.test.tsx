import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import RevisionDetailsTabs from '../../../src/app/(admin)/datasheets/filled/[id]/revisions/RevisionDetailsTabs'
import type { RevisionDetails } from '../../../src/app/(admin)/datasheets/filled/[id]/revisions/RevisionDetailsTabs'
import type { UnifiedSheet } from '../../../src/domain/datasheets/sheetTypes'

const originalFetch = globalThis.fetch

function makeUnifiedSheetSnapshot(): UnifiedSheet {
  return {
    sheetName: 'Test',
    sheetDesc: 'Desc',
    areaId: 1,
    manuId: 1,
    suppId: 1,
    categoryId: 1,
    clientId: 1,
    projectId: 1,
    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,
    revisionNum: 2,
    revisionDate: '2026-01-01',
    equipmentName: 'E',
    equipmentTagNum: 'T',
    serviceName: 'S',
    requiredQty: 1,
    itemLocation: 'L',
    equipSize: 1,
    preparedById: 1,
    preparedByDate: '2026-01-01',
    packageName: 'P',
    subsheets: [
      {
        name: 'Main',
        fields: [
          { label: 'Design Pressure', infoType: 'decimal', sortOrder: 1, required: true, value: '10' },
          { label: 'Design Temp', infoType: 'decimal', sortOrder: 2, required: false, value: '100' },
        ],
      },
    ],
    informationValues: {},
  }
}

function makeRevisionDetails(overrides?: Partial<RevisionDetails>): RevisionDetails {
  return {
    revisionId: 100,
    revisionNumber: 2,
    createdAt: '2026-02-01T12:00:00Z',
    createdBy: 1,
    createdByName: 'Test User',
    status: 'Draft',
    comment: null,
    snapshot: makeUnifiedSheetSnapshot(),
    ...overrides,
  }
}

describe('RevisionDetailsTabs', () => {
  const defaultProps = {
    selectedRevision: makeRevisionDetails(),
    sheetId: 1,
    previousRevisionId: null as number | null,
    onClose: jest.fn(),
    onRestore: jest.fn(),
    canEdit: false,
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('shows Changes tab by default with message when no previous revision', () => {
    render(<RevisionDetailsTabs {...defaultProps} />)
    expect(screen.getByRole('button', { name: /changes/i })).toBeInTheDocument()
    expect(screen.getByText(/no previous revision to compare/i)).toBeInTheDocument()
  })

  it('switches to Snapshot tab and shows structured view', () => {
    render(<RevisionDetailsTabs {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /snapshot/i }))
    expect(screen.getByText(/revision:/i)).toBeInTheDocument()
    expect(screen.getByText(/main/i)).toBeInTheDocument()
    expect(screen.getByText('Design Pressure')).toBeInTheDocument()
  })

  it('switches to Raw JSON tab and shows Copy JSON button', () => {
    render(<RevisionDetailsTabs {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: /raw json/i }))
    expect(screen.getByRole('button', { name: /copy json/i })).toBeInTheDocument()
    expect(screen.getByText(/sheetName/)).toBeInTheDocument()
  })

  it('shows Loading changes… when fetching previous revision', async () => {
    globalThis.fetch = jest.fn(() => new Promise(() => {})) as typeof fetch
    render(
      <RevisionDetailsTabs
        {...defaultProps}
        previousRevisionId={99}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/loading changes/i)).toBeInTheDocument()
    })
  })

  it('shows friendly error when previous revision fetch fails', async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error('network error'))) as typeof fetch
    render(
      <RevisionDetailsTabs
        {...defaultProps}
        previousRevisionId={99}
      />
    )
    await waitFor(() => {
      expect(screen.getByText(/unable to load the previous revision for comparison/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /snapshot/i })).toBeInTheDocument()
  })
})

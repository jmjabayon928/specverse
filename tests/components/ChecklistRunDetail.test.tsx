/**
 * Component test for ChecklistRunDetail
 * Tests UI behavior, state management, and API interactions
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChecklistRunDetail from '@/components/checklists/ChecklistRunDetail'

// Mock fetch
global.fetch = jest.fn()

const mockRunData = {
  runId: 1,
  checklistTemplateId: 10,
  checklistTemplateVersionNumber: 2,
  runName: 'Test Run',
  notes: null,
  projectId: null,
  facilityId: null,
  systemId: null,
  assetId: 100,
  status: 'DRAFT' as const,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  completedAt: null,
  entries: [
    {
      runEntryId: 1,
      templateEntryId: 100,
      sortOrder: 1,
      result: 'PENDING' as const,
      notes: null,
      measuredValue: null,
      uom: null,
      evidenceAttachmentIds: [],
      evidenceAttachments: [],
      rowVersionBase64: 'dmVyc2lvbg==',
    },
  ],
  totalEntries: 1,
  completedEntries: 0,
  pendingEntries: 1,
  passEntries: 0,
  failEntries: 0,
  naEntries: 0,
  completionPercentage: 0,
  pagination: {
    page: 1,
    pageSize: 200,
    totalEntries: 1,
  },
}

describe('ChecklistRunDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('displays loading state initially', () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      () =>
        new Promise(() => {
          // Never resolve to keep loading
        }),
    )

    render(<ChecklistRunDetail runId={1} assetId={100} />)

    expect(screen.getByText(/Loading checklist run/i)).toBeInTheDocument()
  })

  it('displays run details after loading', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRunData,
    })

    render(<ChecklistRunDetail runId={1} assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText('Test Run')).toBeInTheDocument()
    })

    expect(screen.getByText(/Status:/i)).toBeInTheDocument()
    expect(screen.getByText(/Completion:/i)).toBeInTheDocument()
  })

  it('displays error message on fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not found',
    })

    render(<ChecklistRunDetail runId={1} assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load checklist run/i)).toBeInTheDocument()
    })
  })

  it('allows editing entry result', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockRunData,
    })

    render(<ChecklistRunDetail runId={1} assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText('Test Run')).toBeInTheDocument()
    })

    const resultSelect = screen.getByLabelText(/Result/i) as HTMLSelectElement
    expect(resultSelect).toBeInTheDocument()

    await userEvent.selectOptions(resultSelect, 'PASS')

    expect(resultSelect.value).toBe('PASS')
  })

  it('disables editing for COMPLETED runs', async () => {
    const completedRun = {
      ...mockRunData,
      status: 'COMPLETED' as const,
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => completedRun,
    })

    render(<ChecklistRunDetail runId={1} assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText('Test Run')).toBeInTheDocument()
    })

    const resultSelect = screen.getByLabelText(/Result/i) as HTMLSelectElement
    expect(resultSelect).toBeDisabled()
  })

  it('sends PATCH request with rowVersion on save', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRunData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRunData,
      })

    render(<ChecklistRunDetail runId={1} assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText('Test Run')).toBeInTheDocument()
    })

    const resultSelect = screen.getByLabelText(/Result/i)
    await userEvent.selectOptions(resultSelect, 'PASS')

    const saveButton = screen.getByText(/Save Entry/i)
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/backend/checklists/run-entries/1'),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('expectedRowVersionBase64'),
        }),
      )
    })
  })

  it('handles 409 conflict by refreshing and showing error', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRunData,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: async () => 'Conflict',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRunData,
      })

    render(<ChecklistRunDetail runId={1} assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText('Test Run')).toBeInTheDocument()
    })

    const saveButton = screen.getByText(/Save Entry/i)
    await userEvent.click(saveButton)

    await waitFor(() => {
      expect(
        screen.getByText(/Entry was modified by another user/i),
      ).toBeInTheDocument()
    })
  })
})

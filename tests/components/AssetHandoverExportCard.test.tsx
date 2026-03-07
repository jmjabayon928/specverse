/**
 * Targeted tests for AssetHandoverExportCard component.
 * Tests export trigger, polling behavior, and download link display.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AssetHandoverExportCard from '../../src/components/assets/AssetHandoverExportCard'

// Mock next/navigation
const mockReplace = jest.fn()
const mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// Mock fetch
global.fetch = jest.fn()

describe('AssetHandoverExportCard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.delete('exportJobId')
    ;(global.fetch as jest.Mock).mockClear()
  })

  it('renders export button initially', () => {
    render(<AssetHandoverExportCard assetId={100} />)
    expect(screen.getByText('Export Binder')).toBeInTheDocument()
    expect(screen.getByText(/Generate a ZIP file containing/)).toBeInTheDocument()
  })

  it('starts export job on button click', async () => {
    const user = userEvent.setup()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ jobId: 123, status: 'queued' }),
    })

    render(<AssetHandoverExportCard assetId={100} />)
    const button = screen.getByText('Export Binder')
    await user.click(button)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/backend/exports/jobs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          jobType: 'handover_binder',
          params: { assetId: 100 },
        }),
      })
    )
  })

  it('polls job status when jobId is in URL', async () => {
    mockSearchParams.set('exportJobId', '123')
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'running', errorMessage: null, fileName: null }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'completed', errorMessage: null, fileName: 'handover-binder-123.zip' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ downloadUrl: 'http://example.com/download', fileName: 'handover-binder-123.zip' }),
      })

    render(<AssetHandoverExportCard assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText(/Export job #123/)).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/Download/)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows error message when export fails', async () => {
    mockSearchParams.set('exportJobId', '123')
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'failed', errorMessage: 'Export failed', fileName: null }),
    })

    render(<AssetHandoverExportCard assetId={100} />)

    await waitFor(() => {
      expect(screen.getByText('Export failed')).toBeInTheDocument()
    })
  })
})

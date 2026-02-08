// tests/ui/datasheets/InstrumentsLoopsSection.test.tsx
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import InstrumentsLoopsSection from '../../../src/components/datasheets/InstrumentsLoopsSection'

type FetchResponse = {
  ok: boolean
  status?: number
  json: () => Promise<unknown>
}

const originalFetch = globalThis.fetch

describe('InstrumentsLoopsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders empty state when no instruments linked', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async (): Promise<unknown> => [],
    } as FetchResponse)

    render(<InstrumentsLoopsSection sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No instruments linked to this datasheet.')).toBeInTheDocument()
    })
    expect(screen.getByText('Link instrument')).toBeInTheDocument()
  })

  it('renders linked instruments table', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async (): Promise<unknown> => [
        {
          instrumentId: 10,
          instrumentTag: 'PT-101',
          instrumentType: 'Pressure',
          loopTags: ['LC-101'],
          linkRole: null,
        },
      ],
    } as FetchResponse)

    render(<InstrumentsLoopsSection sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('PT-101')).toBeInTheDocument()
    })
    expect(screen.getByText('Pressure')).toBeInTheDocument()
    expect(screen.getByText('LC-101')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Unlink/i })).toBeInTheDocument()
  })

  it('opens picker and lists instruments', async () => {
    let linkedCallCount = 0
    globalThis.fetch = jest.fn().mockImplementation((url: string | URL) => {
      const u = typeof url === 'string' ? url : url.toString()
      if (u.includes('/datasheets/1/instruments') && !u.includes('/link')) {
        linkedCallCount++
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => [],
        } as FetchResponse)
      }
      if (u.includes('/api/backend/instruments')) {
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => [
            { instrumentId: 20, instrumentTag: 'TE-201', instrumentType: 'Temperature' },
          ],
        } as FetchResponse)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${u}`))
    })

    render(<InstrumentsLoopsSection sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No instruments linked to this datasheet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Link instrument'))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Link instrument/i })).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/TE-201/)).toBeInTheDocument()
    })
  })
})

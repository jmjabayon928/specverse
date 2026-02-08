// tests/ui/datasheets/RatingsBlocksList.test.tsx
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import toast from 'react-hot-toast'
import RatingsBlocksList from '../../../src/components/datasheets/RatingsBlocksList'

type FetchResponse = {
  ok: boolean
  status?: number
  json: () => Promise<unknown>
}

const originalFetch = globalThis.fetch

describe('RatingsBlocksList', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders empty state when list endpoint returns []', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async (): Promise<unknown> => [],
    } as FetchResponse)

    render(<RatingsBlocksList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No ratings blocks yet.')).toBeInTheDocument()
    })
  })

  it('creates a block via POST and updates list UI', async () => {
    let listCallCount = 0

    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/ratings') {
        listCallCount++
        if (listCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async (): Promise<unknown> => [],
          } as FetchResponse)
        }
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => [
            {
              ratingsBlockId: 42,
              sheetId: 1,
              blockType: 'Nameplate',
              lockedAt: null,
              lockedBy: null,
              updatedAt: '2025-02-07T12:00:00Z',
            },
          ],
        } as FetchResponse)
      }

      if (url === '/api/backend/ratings' && init?.method === 'POST') {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        if (body.sheetId === 1 && body.blockType === 'Nameplate') {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async (): Promise<unknown> => ({ ratingsBlockId: 42 }),
          } as FetchResponse)
        }
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<RatingsBlocksList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No ratings blocks yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Add Block'))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e\.g\. Nameplate/)).toBeInTheDocument()
    })

    const keyInput = screen.getByPlaceholderText('Key')
    fireEvent.change(keyInput, { target: { value: 'voltage' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(screen.getByText(/Nameplate \(RB-42\)/)).toBeInTheDocument()
    })

    expect(toast.success).toHaveBeenCalledWith('Block created')
  })

  it('when lockedAt exists, Edit/Delete hidden and Unlock visible; clicking Unlock with 403 shows toast', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/ratings') {
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => [
            {
              ratingsBlockId: 10,
              sheetId: 1,
              blockType: 'Nameplate',
              lockedAt: '2025-02-07T10:00:00Z',
              lockedBy: 1,
              updatedAt: '2025-02-07T10:00:00Z',
            },
          ],
        } as FetchResponse)
      }

      if (url === '/api/backend/ratings/10') {
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => ({
            block: {
              ratingsBlockId: 10,
              sheetId: 1,
              blockType: 'Nameplate',
              lockedAt: '2025-02-07T10:00:00Z',
              lockedBy: 1,
              notes: null,
              sourceValueSetId: null,
              createdAt: '2025-02-07T09:00:00Z',
              updatedAt: '2025-02-07T10:00:00Z',
            },
            entries: [],
          }),
        } as FetchResponse)
      }

      if (url === '/api/backend/ratings/10/unlock' && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async (): Promise<unknown> => ({ message: 'Admin required' }),
        } as FetchResponse)
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<RatingsBlocksList sheetId={1} isRevision={false} />)

    await waitFor(() => {
      expect(screen.getByText(/Nameplate \(RB-10\)/)).toBeInTheDocument()
    })

    expect(screen.getByText('Locked')).toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    expect(screen.getByText('Unlock')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /View/ }))

    fireEvent.click(screen.getByText('Unlock'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Admin required to unlock.')
    })
  })

  it('after successful lock, list refreshes and Edit/Delete are hidden', async () => {
    let listCallCount = 0

    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/ratings') {
        listCallCount++
        if (listCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async (): Promise<unknown> => [
              {
                ratingsBlockId: 20,
                sheetId: 1,
                blockType: 'Nameplate',
                lockedAt: null,
                lockedBy: null,
                updatedAt: '2025-02-07T10:00:00Z',
              },
            ],
          } as FetchResponse)
        }
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => [
            {
              ratingsBlockId: 20,
              sheetId: 1,
              blockType: 'Nameplate',
              lockedAt: '2025-02-07T11:00:00Z',
              lockedBy: 1,
              updatedAt: '2025-02-07T11:00:00Z',
            },
          ],
        } as FetchResponse)
      }

      if (url === '/api/backend/ratings/20/lock' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => ({}),
        } as FetchResponse)
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<RatingsBlocksList sheetId={1} sheetStatus="Approved" />)

    await waitFor(() => {
      expect(screen.getByText(/Nameplate \(RB-20\)/)).toBeInTheDocument()
    })

    expect(screen.getByText('Lock')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Lock'))

    await waitFor(() => {
      expect(screen.getByText('Locked')).toBeInTheDocument()
    })

    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    expect(screen.getByText('Unlock')).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith('Block locked')
  })
})

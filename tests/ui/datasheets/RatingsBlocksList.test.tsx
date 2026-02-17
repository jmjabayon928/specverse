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
      if (url === '/api/backend/ratings/templates') {
        return Promise.resolve({ ok: true, json: async (): Promise<unknown> => [] } as FetchResponse)
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

  it('create templated block shows template dropdown and submits POST with templateId + initialValues', async () => {
    const templates = [
      { id: 1, blockType: 'Motor Nameplate', standardCode: 'NEMA_MG1', description: null },
    ]
    const templateDetail = {
      template: { id: 1, blockType: 'Motor Nameplate', standardCode: 'NEMA_MG1' },
      fields: [
        { templateFieldId: 1, fieldKey: 'mfr', label: 'Manufacturer', dataType: 'string', uom: null, isRequired: true, orderIndex: 0 },
        { templateFieldId: 2, fieldKey: 'hp', label: 'Horsepower', dataType: 'decimal', uom: 'hp', isRequired: false, orderIndex: 1 },
      ],
    }
    let postBody: unknown = null
    globalThis.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/ratings') {
        return Promise.resolve({ ok: true, json: async (): Promise<unknown> => [] } as FetchResponse)
      }
      if (url === '/api/backend/ratings/templates') {
        return Promise.resolve({ ok: true, json: async (): Promise<unknown> => templates } as FetchResponse)
      }
      if (url === '/api/backend/ratings/templates/1') {
        return Promise.resolve({ ok: true, json: async (): Promise<unknown> => templateDetail } as FetchResponse)
      }
      if (url === '/api/backend/ratings' && init?.method === 'POST') {
        postBody = init?.body ? JSON.parse(init.body as string) : null
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async (): Promise<unknown> => ({ ratingsBlockId: 50 }),
        } as FetchResponse)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<RatingsBlocksList sheetId={1} />)
    await waitFor(() => {
      expect(screen.getByText('No ratings blocks yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Add Block'))
    await waitFor(() => {
      expect(screen.getByText(/Freeform \(no template\)/)).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByText(/Motor Nameplate \(NEMA_MG1\)/)).toBeInTheDocument()
    })

    const templateSelect = screen.getByRole('combobox')
    fireEvent.change(templateSelect, { target: { value: '1' } })
    await waitFor(() => {
      expect(screen.getByLabelText(/Manufacturer/)).toBeInTheDocument()
    }, { timeout: 3000 })

    fireEvent.change(screen.getByLabelText(/Manufacturer/), { target: { value: 'Acme' } })
    fireEvent.change(screen.getByLabelText(/Horsepower/), { target: { value: '10' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(postBody).not.toBeNull()
      const body = postBody as { templateId?: number; initialValues?: Record<string, string | null> }
      expect(body.templateId).toBe(1)
      expect(body.initialValues).toBeDefined()
      expect(body.initialValues?.mfr).toBe('Acme')
      expect(body.initialValues?.hp).toBe('10')
    })
  })

  it('templated block with lockedAt renders schema-driven fields read-only (no Save or inputs enabled)', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/backend/datasheets/1/ratings') {
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => [
            {
              ratingsBlockId: 15,
              sheetId: 1,
              blockType: 'Motor Nameplate',
              ratingsBlockTemplateId: 1,
              lockedAt: '2025-02-07T12:00:00Z',
              lockedBy: 1,
              updatedAt: '2025-02-07T12:00:00Z',
            },
          ],
        } as FetchResponse)
      }
      if (url === '/api/backend/ratings/15') {
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => ({
            block: {
              ratingsBlockId: 15,
              sheetId: 1,
              blockType: 'Motor Nameplate',
              ratingsBlockTemplateId: 1,
              lockedAt: '2025-02-07T12:00:00Z',
              lockedBy: 1,
              notes: null,
              sourceValueSetId: null,
              createdAt: '2025-02-07T09:00:00Z',
              updatedAt: '2025-02-07T12:00:00Z',
            },
            entries: [{ entryId: 1, ratingsBlockId: 15, key: 'mfr', value: 'Acme', uom: null, orderIndex: 0 }],
          }),
        } as FetchResponse)
      }
      if (url === '/api/backend/ratings/templates/1') {
        return Promise.resolve({
          ok: true,
          json: async (): Promise<unknown> => ({
            template: { id: 1, blockType: 'Motor Nameplate', standardCode: 'NEMA_MG1' },
            fields: [
              { templateFieldId: 1, fieldKey: 'mfr', label: 'Manufacturer', dataType: 'string', uom: null, isRequired: true, orderIndex: 0 },
            ],
          }),
        } as FetchResponse)
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<RatingsBlocksList sheetId={1} />)
    await waitFor(() => {
      expect(screen.getByText(/Motor Nameplate \(RB-15\)/)).toBeInTheDocument()
    })
    expect(screen.getByText('Locked')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /View/ }))
    await waitFor(() => {
      expect(screen.getByText(/Manufacturer/)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    const mfrDisplay = screen.getByText('Acme')
    expect(mfrDisplay).toBeInTheDocument()
  })
})

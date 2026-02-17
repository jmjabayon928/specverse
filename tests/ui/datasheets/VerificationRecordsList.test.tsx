// tests/ui/datasheets/VerificationRecordsList.test.tsx
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import VerificationRecordsList from '../../../src/components/datasheets/VerificationRecordsList'

const originalFetch = globalThis.fetch

describe('VerificationRecordsList', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders loading state initially', () => {
    globalThis.fetch = jest.fn().mockImplementation(
      () =>
        new Promise(() => {
          // Never resolve to keep loading state
        })
    )

    render(<VerificationRecordsList sheetId={1} />)
    expect(screen.getByText('Loading verification records…')).toBeInTheDocument()
  })

  it('renders empty state when API returns empty array', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    render(<VerificationRecordsList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No verification records linked to this sheet.')).toBeInTheDocument()
    })
  })

  it('renders list of records when API returns data', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { verificationRecordId: 100, accountId: 1 },
        { verificationRecordId: 200, accountId: 1 },
      ],
    })

    render(<VerificationRecordsList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
      expect(screen.getByText('VR-200')).toBeInTheDocument()
    })
  })

  it('displays error message on fetch failure', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<VerificationRecordsList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText(/Failed to load verification records/)).toBeInTheDocument()
    })
  })

  it('creates and links verification record, then refreshes list', async () => {
    const fetchCalls: string[] = []

    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      fetchCalls.push(url)

      if (url === '/api/backend/datasheets/1/verification-records') {
        if (fetchCalls.filter((c) => c === url).length === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationRecordId: 100, accountId: 1 }],
        })
      }

      if (url === '/api/backend/verification-records/verification-record-types') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' }],
        })
      }

      if (url === '/api/backend/verification-records' && options?.method === 'POST') {
        const body = options?.body ? JSON.parse(options.body as string) : {}
        if (body.verificationTypeId === 1 && !('result' in body)) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({ verificationRecordId: 100 }),
          })
        }
        return Promise.reject(new Error('Invalid create body'))
      }

      if (url === '/api/backend/verification-records/100/link' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ accountId: 1, verificationRecordId: 100, sheetId: 1 }),
        })
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<VerificationRecordsList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No verification records linked to this sheet.')).toBeInTheDocument()
    })

    const button = screen.getByText('Create & Link')
    fireEvent.click(button)

    expect(screen.getByText('Creating…')).toBeInTheDocument()
    expect(button).toBeDisabled()

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
    })

    expect(fetchCalls).toEqual([
      '/api/backend/datasheets/1/verification-records',
      '/api/backend/verification-records/verification-record-types',
      '/api/backend/verification-records',
      '/api/backend/verification-records/100/link',
      '/api/backend/datasheets/1/verification-records',
    ])
  })

  it('uses fetched verification type ID in create POST, preferring GEN code', async () => {
    let createBody: unknown = null

    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/verification-records') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }

      if (url === '/api/backend/verification-records/verification-record-types') {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { verificationTypeId: 7, code: 'TEST', name: 'Test Type', status: 'Active' },
            { verificationTypeId: 1, code: ' gen ', name: 'General Verification', status: 'Active' },
            { verificationTypeId: 5, code: 'SPEC', name: 'Special Verification', status: 'Active' },
          ],
        })
      }

      if (url === '/api/backend/verification-records' && options?.method === 'POST') {
        createBody = options?.body ? JSON.parse(options.body as string) : null
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ verificationRecordId: 100 }),
        })
      }

      if (url === '/api/backend/verification-records/100/link' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ accountId: 1, verificationRecordId: 100, sheetId: 1 }),
        })
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<VerificationRecordsList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No verification records linked to this sheet.')).toBeInTheDocument()
    })

    const button = screen.getByText('Create & Link')
    fireEvent.click(button)

    await waitFor(() => {
      expect(createBody).toEqual({ verificationTypeId: 1 })
    })
  })

  it('displays error when create fails', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/verification-records') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }

      if (url === '/api/backend/verification-records/verification-record-types') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' }],
        })
      }

      if (url === '/api/backend/verification-records' && options?.method === 'POST') {
        const body = options?.body ? JSON.parse(options.body as string) : {}
        if (body.verificationTypeId === 1 && !('result' in body)) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Server error',
          })
        }
        return Promise.reject(new Error('Invalid create body'))
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<VerificationRecordsList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No verification records linked to this sheet.')).toBeInTheDocument()
    })

    const button = screen.getByText('Create & Link')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Create failed \(500\)/)).toBeInTheDocument()
    })

    expect(button).not.toBeDisabled()
    expect(screen.queryByText('VR-100')).not.toBeInTheDocument()
  })

  it('displays error when link fails', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/verification-records') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }

      if (url === '/api/backend/verification-records/verification-record-types') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' }],
        })
      }

      if (url === '/api/backend/verification-records' && options?.method === 'POST') {
        const body = options?.body ? JSON.parse(options.body as string) : {}
        if (body.verificationTypeId === 1 && !('result' in body)) {
          return Promise.resolve({
            ok: true,
            status: 201,
            json: async () => ({ verificationRecordId: 100 }),
          })
        }
        return Promise.reject(new Error('Invalid create body'))
      }

      if (url === '/api/backend/verification-records/100/link' && options?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 404,
        })
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<VerificationRecordsList sheetId={1} />)

    await waitFor(() => {
      expect(screen.getByText('No verification records linked to this sheet.')).toBeInTheDocument()
    })

    const button = screen.getByText('Create & Link')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText('Link failed (404)')).toBeInTheDocument()
    })

    expect(button).not.toBeDisabled()
    expect(screen.queryByText('VR-100')).not.toBeInTheDocument()
  })

  it('expands evidence, attaches evidence, and refreshes evidence list', async () => {
    const fetchCalls: string[] = []

    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      fetchCalls.push(url)

      if (url === '/api/backend/datasheets/1/verification-records') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationRecordId: 100, accountId: 1 }],
        })
      }

      if (url === '/api/backend/verification-records/verification-record-types') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' }],
        })
      }

      if (url === '/api/backend/verification-records/100/attachments') {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ attachmentId: 50, verificationRecordId: 100 }),
          })
        }
        const callCount = fetchCalls.filter((c) => c === url).length
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => [],
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ attachmentId: 50, verificationRecordId: 100 }],
        })
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const sheetAttachments = [
      { attachmentId: 50, originalName: 'test.pdf' },
      { attachmentId: 60, originalName: 'spec.pdf' },
    ]

    render(<VerificationRecordsList sheetId={1} sheetAttachments={sheetAttachments} />)

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
    })

    const evidenceButton = screen.getByText('Evidence ▼')
    fireEvent.click(evidenceButton)

    await waitFor(() => {
      expect(screen.getByText('No evidence attached.')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '50' } })

    const attachButton = screen.getByText('Attach')
    fireEvent.click(attachButton)

    expect(screen.getByText('Attaching…')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    expect(fetchCalls).toEqual([
      '/api/backend/datasheets/1/verification-records',
      '/api/backend/verification-records/verification-record-types',
      '/api/backend/verification-records/100/attachments',
      '/api/backend/verification-records/100/attachments',
      '/api/backend/verification-records/100/attachments',
    ])
  })

  it('prevents duplicate evidence attach when already in evidence list', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/backend/datasheets/1/verification-records') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationRecordId: 100, accountId: 1 }],
        })
      }

      if (url === '/api/backend/verification-records/verification-record-types') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationTypeId: 1, code: 'GEN', name: 'General Verification', status: 'Active' }],
        })
      }

      if (url === '/api/backend/verification-records/100/attachments') {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 409,
          })
        }
        return Promise.resolve({
          ok: true,
          json: async () => [{ attachmentId: 50, verificationRecordId: 100 }],
        })
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    const sheetAttachments = [
      { attachmentId: 50, originalName: 'test.pdf' },
      { attachmentId: 60, originalName: 'spec.pdf' },
    ]

    render(<VerificationRecordsList sheetId={1} sheetAttachments={sheetAttachments} />)

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
    })

    const evidenceButton = screen.getByText('Evidence ▼')
    fireEvent.click(evidenceButton)

    await waitFor(() => {
      expect(screen.getByText('test.pdf')).toBeInTheDocument()
    })

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '50' } })

    const attachButton = screen.getByText('Attach')
    fireEvent.click(attachButton)

    await waitFor(() => {
      expect(screen.getByText('Already attached')).toBeInTheDocument()
    })

    const postCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(
      (call) => call[0] === '/api/backend/verification-records/100/attachments' && call[1]?.method === 'POST'
    )
    expect(postCalls.length).toBe(0)
  })
})

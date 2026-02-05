// tests/ui/verification/VerificationRecordsGlobalPage.test.tsx
import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import VerificationRecordsPage from '../../../src/app/(admin)/verification-records/page'

const originalFetch = globalThis.fetch

jest.mock('../../../src/hooks/useSession', () => ({
  useSession: jest.fn(() => ({
    user: { userId: 1, accountId: 1, role: 'Admin' },
    loading: false,
  })),
}))

jest.mock('../../../src/components/security/SecurePage', () => {
  return function SecurePage({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>
  }
})

describe('VerificationRecordsGlobalPage', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders list of records from API', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { verificationRecordId: 100, accountId: 1 },
        { verificationRecordId: 200, accountId: 1 },
      ],
    })

    render(<VerificationRecordsPage />)

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
      expect(screen.getByText('VR-200')).toBeInTheDocument()
    })
  })

  it('applies ID filter and shows single record', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/backend/verification-records?limit=20&offset=0') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }
      if (url === '/api/backend/verification-records/100') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ verificationRecordId: 100, accountId: 1 }),
        })
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<VerificationRecordsPage />)

    await waitFor(() => {
      expect(screen.getByText('No verification records found.')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Enter verification record ID')
    fireEvent.change(input, { target: { value: '100' } })

    const applyButton = screen.getByText('Apply')
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
    })

    expect(screen.queryByText('Previous')).not.toBeInTheDocument()
    expect(screen.queryByText('Next')).not.toBeInTheDocument()
  })

  it('shows not found message when ID filter returns 404', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/backend/verification-records?limit=20&offset=0') {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        })
      }
      if (url === '/api/backend/verification-records/999') {
        return Promise.resolve({
          ok: false,
          status: 404,
        })
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<VerificationRecordsPage />)

    await waitFor(() => {
      expect(screen.getByText('No verification records found.')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Enter verification record ID')
    fireEvent.change(input, { target: { value: '999' } })

    const applyButton = screen.getByText('Apply')
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(screen.getByText('Verification record 999 not found')).toBeInTheDocument()
    })
  })

  it('expands evidence and loads evidence list', async () => {
    globalThis.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/backend/verification-records?limit=20&offset=0') {
        return Promise.resolve({
          ok: true,
          json: async () => [{ verificationRecordId: 100, accountId: 1 }],
        })
      }
      if (url === '/api/backend/verification-records/100/attachments') {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { attachmentId: 50, verificationRecordId: 100 },
            { attachmentId: 60, verificationRecordId: 100 },
          ],
        })
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })

    render(<VerificationRecordsPage />)

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
    })

    const evidenceButton = screen.getByText('Evidence ▼')
    fireEvent.click(evidenceButton)

    await waitFor(() => {
      expect(screen.getByText('Attachment 50')).toBeInTheDocument()
      expect(screen.getByText('Attachment 60')).toBeInTheDocument()
    })
  })

  it('shows Next button when list length equals pageSize', async () => {
    const mockRecords = Array.from({ length: 20 }, (_, i) => ({
      verificationRecordId: 100 + i,
      accountId: 1,
    }))

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRecords,
    })

    render(<VerificationRecordsPage />)

    await waitFor(() => {
      expect(screen.getByText('VR-100')).toBeInTheDocument()
    })

    expect(screen.getByText('Next')).toBeInTheDocument()
    expect(screen.getByText('Next')).not.toBeDisabled()
  })
})

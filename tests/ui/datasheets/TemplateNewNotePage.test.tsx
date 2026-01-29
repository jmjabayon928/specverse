// tests/ui/datasheets/TemplateNewNotePage.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../../../src/app/(admin)/datasheets/templates/[id]/notes/new/page'

jest.mock('next/navigation', () => {
  const params = new URLSearchParams('')
  return {
    useRouter: () => ({
      push: jest.fn(() => Promise.resolve()),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      refresh: jest.fn(),
    }),
    useParams: () => ({ id: '123' }),
    useSearchParams: () => ({
      get: (k: string) => params.get(k),
      toString: () => params.toString(),
    }),
  }
})

describe('Template notes new page', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response)
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('sends { text } in the request body to /api/backend/templates/:id/notes', async () => {
    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ noteTypeId: 1, noteType: 'General' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          datasheet: { sheetName: 'Test Template', equipmentTagNum: 'T-1' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

    render(<Page />)

    await waitFor(() => {
      expect(screen.getByLabelText(/note type/i)).toBeInTheDocument()
    })

    const textarea = screen.getByLabelText(/note text/i)
    fireEvent.change(textarea, { target: { value: 'This is a test note.' } })

    fireEvent.change(screen.getByLabelText(/note type/i), {
      target: { value: '1' },
    })

    const button = screen.getByRole('button', { name: /save note/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    const postCall = fetchMock.mock.calls.find(
      (call: [string, RequestInit]) =>
        call[0] === '/api/backend/templates/123/notes' && call[1]?.method === 'POST'
    )
    expect(postCall).toBeDefined()
    const [, options] = postCall as [string, RequestInit]
    const parsedBody = JSON.parse(String(options?.body))
    expect(parsedBody).toEqual({ noteTypeId: 1, text: 'This is a test note.' })
  })
})

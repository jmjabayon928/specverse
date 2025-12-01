// tests/ui/datasheets/TemplateNewNotePage.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import Page from '../../../src/app/(admin)/datasheets/templates/[id]/notes/new/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
  useParams: () => ({
    id: '123',
  }),
}))

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
    render(<Page />)

    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'This is a test note.' } })

    const button = screen.getByRole('button', { name: /add note/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0]

    expect(url).toBe('/api/backend/templates/123/notes')

    const parsedBody = JSON.parse(options.body as string)
    expect(parsedBody.text).toBe('This is a test note.')
    expect(parsedBody.body).toBeUndefined()
  })
})

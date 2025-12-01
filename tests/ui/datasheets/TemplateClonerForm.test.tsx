// tests/ui/datasheets/TemplateClonerForm.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TemplateClonerForm from '../../../src/app/(admin)/datasheets/templates/[id]/clone/TemplateClonerForm'
import { makeBasicUnifiedSheet, makeOptions } from './datasheetTestUtils'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

describe('TemplateClonerForm', () => {
  const areas = makeOptions([1])
  const manufacturers = makeOptions([1])
  const suppliers = makeOptions([1])
  const categories = makeOptions([1])
  const clients = makeOptions([1])
  const projects = makeOptions([1])

  beforeEach(() => {
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('requires at least one subsheet and shows error if none', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.subsheets = []

    render(
      <TemplateClonerForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    const button = screen.getByRole('button', { name: /create cloned template/i })
    fireEvent.click(button)

    const error = await screen.findByText(/at least one subsheet is required/i)
    expect(error).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('POSTs to /api/backend/templates on success', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 99

    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sheetId: 1234 }),
    })

    render(
      <TemplateClonerForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    const button = screen.getByRole('button', { name: /create cloned template/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0]

    expect(url).toBe('/api/backend/templates')

    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  })
})

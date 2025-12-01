// tests/ui/datasheets/FilledSheetClonerForm.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FilledSheetClonerForm from '../../../src/app/(admin)/datasheets/filled/[id]/clone/FilledSheetClonerForm'
import { makeBasicUnifiedSheet, makeOptions } from './datasheetTestUtils'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

describe('FilledSheetClonerForm', () => {
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

  it('requires equipment tag number and shows error when missing', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 300
    sheet.equipmentTagNum = ''

    render(
      <FilledSheetClonerForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    const button = screen.getByRole('button', { name: /create cloned sheet/i })
    fireEvent.click(button)

    const error = await screen.findByText(/equipment tag is required/i)
    expect(error).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('POSTs to /api/backend/filledsheets on success', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 301
    sheet.equipmentTagNum = 'P-CLONE-301'

    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sheetId: 999 }),
    })

    render(
      <FilledSheetClonerForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    const button = screen.getByRole('button', { name: /create cloned sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0]

    expect(url).toBe('/api/backend/filledsheets')
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  })
})

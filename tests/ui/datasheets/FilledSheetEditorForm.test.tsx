// tests/ui/datasheets/FilledSheetEditorForm.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import FilledSheetEditorForm from '../../../src/app/(admin)/datasheets/filled/[id]/edit/FilledSheetEditorForm'
import { makeBasicUnifiedSheet, makeOptions } from './datasheetTestUtils'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

describe('FilledSheetEditorForm', () => {
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

  it('renders and shows subsheet form', () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.isTemplate = false

    render(
      <FilledSheetEditorForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    expect(screen.getByText('Edit Filled Sheet')).toBeInTheDocument()
    expect(screen.getByLabelText('Sheet Name')).toBeInTheDocument()
    expect(screen.getByText('Subsheet(s)')).toBeInTheDocument()
  })

  it('PUTs to /api/backend/filledsheets/:id with fieldValues', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 222
    sheet.isTemplate = false

    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sheetId: sheet.sheetId }),
    })

    render(
      <FilledSheetEditorForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    const button = screen.getByRole('button', { name: /update filled sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0]

    expect(url).toBe(`/api/backend/filledsheets/${sheet.sheetId}`)
    expect(options).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })

    const parsedBody = JSON.parse(options.body as string)
    expect(typeof parsedBody.fieldValues).toBe('object')
  })
})

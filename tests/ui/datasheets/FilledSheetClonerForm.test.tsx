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

  it('renders clone UX hint about template structure and UOM inherited', () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 300

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

    const hint = screen.getByRole('status')
    expect(hint).toHaveTextContent(/Template structure and units \(UOM\) are inherited/)
    expect(hint).toHaveTextContent(/Cloning creates a new filled sheet; edit values and identity fields only/)
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

    const errors = await screen.findAllByText(/Equipment Tag Number is required/i)
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0]).toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('POSTs to /api/backend/filledsheets on success', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 301

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({
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

    const equipmentTagLabel = screen.getByText('Equipment Tag Number')
    const equipmentTagInput = equipmentTagLabel.closest('div')?.querySelector('input')
    expect(equipmentTagInput).toBeTruthy()
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-301' } })

    const button = screen.getByRole('button', { name: /create cloned sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit]) => call[0] === '/api/backend/filledsheets'
      )
      expect(postCall).toBeDefined()
    })

    const postCall = fetchMock.mock.calls.find(
      (call: [string, RequestInit]) => call[0] === '/api/backend/filledsheets'
    )
    const [url, options] = postCall as [string, RequestInit]

    expect(url).toBe('/api/backend/filledsheets')
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('does not show uom errors when template has invalid uom (clone validates only user-editable fields)', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 302
    // Template-owned uom that would fail unifiedSheetSchema (number is invalid for uom)
    if (sheet.subsheets[0]?.fields[0]) {
      (sheet.subsheets[0].fields[0] as { uom?: unknown }).uom = 123
    }

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sheetId: 998 }),
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

    expect(screen.queryByText(/uom.*invalid/i)).not.toBeInTheDocument()

    const equipmentTagLabel = screen.getByText('Equipment Tag Number')
    const equipmentTagInput = equipmentTagLabel.closest('div')?.querySelector('input')
    expect(equipmentTagInput).toBeTruthy()
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-302' } })

    const button = screen.getByRole('button', { name: /create cloned sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit]) => call[0] === '/api/backend/filledsheets'
      )
      expect(postCall).toBeDefined()
    })
    expect(screen.queryByText(/uom.*invalid/i)).not.toBeInTheDocument()
  })
})

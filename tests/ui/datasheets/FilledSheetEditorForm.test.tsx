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
    expect(screen.getByDisplayValue('Test Sheet')).toBeInTheDocument()
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

  it('shows completeness hint when a required subsheet field is empty', () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.isTemplate = false
    sheet.subsheets[0].fields[0].value = ''
    sheet.subsheets[0].fields[0].required = true

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

    expect(screen.getByText(/Required field is empty/)).toBeInTheDocument()
    expect(screen.getAllByText(/1 required field missing/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows all complete when all required subsheet fields are filled', () => {
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

    expect(screen.getAllByText(/All required fields complete/).length).toBeGreaterThanOrEqual(1)
  })

  it('submit button is enabled when required field is empty (hints do not block)', () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.isTemplate = false
    sheet.subsheets[0].fields[0].value = ''
    sheet.subsheets[0].fields[0].required = true

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
    expect(button).toBeEnabled()
  })

  it('renders header fields as disabled when readOnlyHeader is true', () => {
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
        readOnlyHeader={true}
      />
    )

    const sheetNameInput = screen.getByDisplayValue('Test Sheet')
    expect(sheetNameInput).toBeDisabled()
  })

  it('renders at least one InformationValue input enabled when readOnlyHeader is true', () => {
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
        readOnlyHeader={true}
      />
    )

    const designPressureInput = screen.getByDisplayValue('10')
    expect(designPressureInput).not.toBeDisabled()
  })

  it('shows red banner and mentions sheetName when 400 returns headerFieldErrors', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.isTemplate = false
    sheet.sheetId = 333

    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Header fields are read-only for filled sheet edit.',
        headerFieldErrors: [
          { field: 'sheetName', message: 'Header fields are read-only on filled sheet edit.' },
        ],
      }),
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
        readOnlyHeader={true}
      />
    )

    const button = screen.getByRole('button', { name: /update filled sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByText(/Header fields are read-only\. Remove changes to:/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Header fields are read-only\. Remove changes to:/)).toHaveTextContent('sheetName')
  })

  it('submit validation passes when field.uom is array (schema normalizes to string)', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.isTemplate = false
    sheet.sheetId = 444
    const firstField = sheet.subsheets[0].fields[0]
    firstField.uom = ['kW', 'kW'] as unknown as string

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
        readOnlyHeader={true}
      />
    )

    const button = screen.getByRole('button', { name: /update filled sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    expect(screen.queryByText(/uom.*Expected string|Expected string.*uom/i)).not.toBeInTheDocument()
  })
})

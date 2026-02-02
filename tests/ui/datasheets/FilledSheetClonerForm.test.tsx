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
        sourceSheetId={300}
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

  it('shows warning banner when a field has no id/originalId', () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 400
    const fields = sheet.subsheets[0]?.fields ?? []
    fields.push({
      id: undefined,
      originalId: undefined,
      label: 'No-ID Field',
      infoType: 'varchar',
      sortOrder: 3,
      required: false,
      value: 'dropped',
    })

    render(
      <FilledSheetClonerForm
        sourceSheetId={400}
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    expect(
      screen.getByText(/Some fields could not be copied because they have no identifier/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/template defaults/)
  })

  it('requires equipment tag number and shows error when missing', async () => {
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 300
    sheet.equipmentTagNum = ''

    render(
      <FilledSheetClonerForm
        sourceSheetId={300}
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

  it('POSTs to /api/backend/filledsheets/:id/clone on success', async () => {
    const sourceId = 1240
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = sourceId

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sheetId: 999 }),
      })

    render(
      <FilledSheetClonerForm
        sourceSheetId={sourceId}
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
      const cloneUrl = `/api/backend/filledsheets/${sourceId}/clone`
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit]) => call[0] === cloneUrl
      )
      expect(postCall).toBeDefined()
    })

    const cloneUrl = `/api/backend/filledsheets/${sourceId}/clone`
    const postCall = fetchMock.mock.calls.find(
      (call: [string, RequestInit]) => call[0] === cloneUrl
    )
    const [url, options] = postCall as [string, RequestInit]

    expect(url).toBe(cloneUrl)
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('sends fieldValues keyed by template id (originalId ?? id)', async () => {
    const sourceId = 500
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = sourceId
    const templateIdDecimal = 3792
    const templateIdOptions = 3797
    const fields = sheet.subsheets[0]?.fields ?? []
    if (fields[0]) {
      fields[0].originalId = templateIdDecimal
      fields[0].id = 5001
      fields[0].value = '42.5'
      fields[0].infoType = 'decimal'
    }
    if (fields[1]) {
      fields[1].originalId = templateIdOptions
      fields[1].id = 5002
      fields[1].value = 'A'
      fields[1].infoType = 'varchar'
      fields[1].options = ['D', 'E', 'F']
    }

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheetId: 888 }) })

    render(
      <FilledSheetClonerForm
        sourceSheetId={sourceId}
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
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-500' } })

    const decimalInput = screen.getByDisplayValue('42.5')
    fireEvent.change(decimalInput, { target: { value: '23' } })

    const comboboxes = screen.getAllByRole('combobox')
    const optionsSelect = comboboxes.find((el) => el.querySelector('option[value="D"]'))
    expect(optionsSelect).toBeTruthy()
    fireEvent.change(optionsSelect!, { target: { value: 'D' } })

    const button = screen.getByRole('button', { name: /create cloned sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      const cloneUrl = `/api/backend/filledsheets/${sourceId}/clone`
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit]) => call[0] === cloneUrl
      )
      expect(postCall).toBeDefined()
    })

    const cloneCall = fetchMock.mock.calls.find(
      (call: [string, RequestInit]) => call[0] === `/api/backend/filledsheets/${sourceId}/clone`
    ) as [string, RequestInit]
    const body = JSON.parse((cloneCall[1].body as string) || '{}')
    expect(body.fieldValues).toBeDefined()
    expect(body.fieldValues[String(templateIdDecimal)]).toBe('23')
    expect(body.fieldValues[String(templateIdOptions)]).toBe('D')
    expect(body.fieldValues[String(templateIdDecimal)]).not.toBe('varchar12')
    expect(body.fieldValues[String(templateIdOptions)]).not.toBe('A')
  })

  it('omits fieldValues entries when source value is null/undefined/empty', async () => {
    const sourceId = 600
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = sourceId
    const fields = sheet.subsheets[0]?.fields ?? []
    const idWithValue = fields[0]?.id ?? 1001
    const idEmpty = fields[1]?.id ?? 1002
    if (fields[0]) {
      fields[0].value = '42'
      fields[0].infoType = 'decimal'
    }
    if (fields[1]) {
      fields[1].value = undefined
      fields[1].required = false
      fields[1].infoType = 'decimal'
    }

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheetId: 777 }) })

    render(
      <FilledSheetClonerForm
        sourceSheetId={sourceId}
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
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-600' } })

    const button = screen.getByRole('button', { name: /create cloned sheet/i })
    fireEvent.click(button)

    await waitFor(() => {
      const postCall = fetchMock.mock.calls.find(
        (call: [string, RequestInit]) => call[0] === `/api/backend/filledsheets/${sourceId}/clone`
      )
      expect(postCall).toBeDefined()
    })

    const cloneCall = fetchMock.mock.calls.find(
      (call: [string, RequestInit]) => call[0] === `/api/backend/filledsheets/${sourceId}/clone`
    ) as [string, RequestInit]
    const body = JSON.parse((cloneCall[1].body as string) || '{}')
    expect(body.fieldValues).toBeDefined()
    expect(body.fieldValues[String(idWithValue)]).toBe('42')
    expect(Object.prototype.hasOwnProperty.call(body.fieldValues, String(idEmpty))).toBe(false)
  })

  it('shows backend fieldErrors in banner with subsheet and field label when clone returns 400', async () => {
    const sourceId = 700
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = sourceId
    const fieldErrors = [
      { infoTemplateId: 1001, message: 'Invalid decimal value' },
      { infoTemplateId: 1002, message: 'Value out of range' },
    ]

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ fieldErrors }),
      })

    render(
      <FilledSheetClonerForm
        sourceSheetId={sourceId}
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
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-700' } })
    fireEvent.click(screen.getByRole('button', { name: /create cloned sheet/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/api/backend/filledsheets/${sourceId}/clone`),
        expect.any(Object)
      )
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Invalid decimal value')
    expect(alert).toHaveTextContent('Value out of range')
    expect(alert).toHaveTextContent('Main')
    expect(alert).toHaveTextContent('Design Pressure')
    expect(alert).toHaveTextContent('Design Temperature')
  })

  it('shows backend fieldErrors inline under the corresponding field', async () => {
    const sourceId = 701
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = sourceId
    const fieldErrors = [{ infoTemplateId: 1001, message: 'Invalid decimal value' }]

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ fieldErrors }),
      })

    render(
      <FilledSheetClonerForm
        sourceSheetId={sourceId}
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
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-701' } })
    fireEvent.click(screen.getByRole('button', { name: /create cloned sheet/i }))

    await waitFor(() => {
      const errorKeyDiv = document.querySelector(
        '[data-error-key="Subsheet #1 - Template #1 - value"]'
      )
      expect(errorKeyDiv).toBeInTheDocument()
      expect(errorKeyDiv).toHaveTextContent('Invalid decimal value')
    })
  })

  it('normalizes decimal input to finite number or blank and prevents submit when required decimal is blank', async () => {
    const sourceId = 702
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = sourceId
    const fields = sheet.subsheets[0]?.fields ?? []
    const decimalField = fields[0]
    expect(decimalField?.required).toBe(true)
    expect(decimalField?.infoType).toBe('decimal')

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ exists: false }) })

    render(
      <FilledSheetClonerForm
        sourceSheetId={sourceId}
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
      />
    )

    const decimalInput = screen.getByDisplayValue('10')
    expect(decimalInput).toHaveAttribute('type', 'number')
    fireEvent.change(decimalInput, { target: { value: 'varchar12' } })
    await waitFor(() => {
      expect((decimalInput as HTMLInputElement).value).toBe('')
    })
    expect(screen.getByText('This field is required.')).toBeInTheDocument()

    const equipmentTagLabel = screen.getByText('Equipment Tag Number')
    const equipmentTagInput = equipmentTagLabel.closest('div')?.querySelector('input')
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-702' } })
    fireEvent.click(screen.getByRole('button', { name: /create cloned sheet/i }))

    await waitFor(() => {
      const cloneCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
        (call) => call[0]?.includes('/clone')
      )
      expect(cloneCalls.length).toBe(0)
    })
  })

  it('does not send invalid option value in clone payload when defaultValues has value outside options', async () => {
    const sourceId = 703
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = sourceId
    const templateIdOptions = 3797
    const fields = sheet.subsheets[0]?.fields ?? []
    if (fields[1]) {
      fields[1].originalId = templateIdOptions
      fields[1].id = 5002
      fields[1].value = 'A'
      fields[1].infoType = 'varchar'
      fields[1].options = ['D', 'E', 'F']
    }

    const fetchMock = globalThis.fetch as jest.Mock
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ exists: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sheetId: 888 }) })

    render(
      <FilledSheetClonerForm
        sourceSheetId={sourceId}
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
    fireEvent.change(equipmentTagInput!, { target: { value: 'P-CLONE-703' } })
    const optionSelect = screen.getAllByRole('combobox').find((el) => {
      const opts = Array.from(el.querySelectorAll('option')).map((o) => o.getAttribute('value'))
      return opts?.includes('D') && opts?.includes('E')
    })
    expect(optionSelect).toBeTruthy()
    fireEvent.change(optionSelect!, { target: { value: 'D' } })
    fireEvent.click(screen.getByRole('button', { name: /create cloned sheet/i }))

    await waitFor(() => {
      const cloneCall = (fetchMock.mock.calls as [string, RequestInit][]).find(
        (call) => call[0] === `/api/backend/filledsheets/${sourceId}/clone`
      )
      expect(cloneCall).toBeDefined()
    })

    const cloneCall = (fetchMock.mock.calls as [string, RequestInit][]).find(
      (call) => call[0] === `/api/backend/filledsheets/${sourceId}/clone`
    )!
    const body = JSON.parse((cloneCall[1].body as string) || '{}')
    expect(body.fieldValues[String(templateIdOptions)]).toBe('D')
    expect(body.fieldValues[String(templateIdOptions)]).not.toBe('A')
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
        sourceSheetId={302}
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
        (call: [string, RequestInit]) => call[0] === '/api/backend/filledsheets/302/clone'
      )
      expect(postCall).toBeDefined()
    })
    expect(screen.queryByText(/uom.*invalid/i)).not.toBeInTheDocument()
  })
})

// tests/ui/datasheets/FilledSheetCreatorForm.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import FilledSheetCreatorForm from '../../../src/app/(admin)/datasheets/filled/create/FilledSheetCreatorForm'
import { makeBasicUnifiedSheet, getMockReferenceOptions } from './datasheetTestUtils'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

function mockReferenceOptions(): void {
  const opts = getMockReferenceOptions()
  ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      areas: [],
      manufacturers: [],
      suppliers: [],
      clients: [],
      projects: [],
      ...opts,
    }),
  })
}

describe('FilledSheetCreatorForm', () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('blocks submit when required decimal is blank', async () => {
    mockReferenceOptions()
    const template = makeBasicUnifiedSheet()
    render(
      <FilledSheetCreatorForm
        template={template}
        language="eng"
      />
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('reference-options'),
        expect.any(Object)
      )
    })

    const submitButton = screen.getByRole('button', { name: /submit filled sheet/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      const postCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(
        (call: [string]) => call[0]?.includes('/api/backend/filledsheets') && !call[0]?.includes('reference-options')
      )
      expect(postCalls.length).toBe(0)
    })
    expect(screen.getByText(/please fill the required field/i)).toBeInTheDocument()
  })

  it('shows inline "Enter a number." for non-numeric decimal and does not submit', async () => {
    mockReferenceOptions()
    const template = makeBasicUnifiedSheet()
    render(
      <FilledSheetCreatorForm
        template={template}
        language="eng"
      />
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('reference-options'),
        expect.any(Object)
      )
    })

    const mainFieldset = screen.getByRole('group', { name: 'Main' })
    const designPressureLabel = within(mainFieldset).getByText(/Design Pressure/)
    const designPressureInput = designPressureLabel.closest('div')?.querySelector('input')
    expect(designPressureInput).toBeTruthy()
    fireEvent.change(designPressureInput!, { target: { value: 'varchar12' } })

    await waitFor(() => {
      expect(within(mainFieldset).getByText('Enter a number.')).toBeInTheDocument()
    })

    const submitButton = screen.getByRole('button', { name: /submit filled sheet/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      const postCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(
        (call: [string]) => call[0]?.includes('/api/backend/filledsheets') && !call[0]?.includes('reference-options')
      )
      expect(postCalls.length).toBe(0)
    })
  })

  it('omits blank optional numeric from payload on submit', async () => {
    mockReferenceOptions()
    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sheetId: 999 }),
    })

    const template = makeBasicUnifiedSheet()
    render(
      <FilledSheetCreatorForm
        template={template}
        language="eng"
      />
    )

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('reference-options'),
        expect.any(Object)
      )
    })

    const mainFieldset = screen.getByRole('group', { name: 'Main' })
    const designPressureLabel = within(mainFieldset).getByText(/Design Pressure/)
    const designPressureInput = designPressureLabel.closest('div')?.querySelector('input')
    const designTempLabel = within(mainFieldset).getByText(/Design Temperature/)
    const designTempInput = designTempLabel.closest('div')?.querySelector('input')
    expect(designPressureInput).toBeTruthy()
    fireEvent.change(designPressureInput!, { target: { value: '10' } })
    if (designTempInput) {
      fireEvent.change(designTempInput, { target: { value: '' } })
    }

    const submitButton = screen.getByRole('button', { name: /submit filled sheet/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      const postCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(
        (call: [string]) => call[0] === '/api/backend/filledsheets' || call[0]?.endsWith('/api/backend/filledsheets')
      )
      expect(postCalls.length).toBeGreaterThanOrEqual(1)
    })

    const postCall = (globalThis.fetch as jest.Mock).mock.calls.find(
      (call: [string, RequestInit]) => call[0]?.includes('/api/backend/filledsheets') && !call[0]?.includes('reference-options')
    ) as [string, RequestInit] | undefined
    expect(postCall).toBeDefined()
    const body = JSON.parse((postCall![1].body as string) || '{}')
    expect(body.fieldValues).toBeDefined()
    expect(body.fieldValues['1001']).toBe('10')
    expect(Object.prototype.hasOwnProperty.call(body.fieldValues, '1002')).toBe(false)
  })
})

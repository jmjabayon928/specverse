// tests/ui/datasheets/TemplateEditorForm.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TemplateEditorForm from '../../../src/app/(admin)/datasheets/templates/[id]/edit/TemplateEditorForm'
import { makeBasicUnifiedSheet, makeOptions } from './datasheetTestUtils'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

describe('TemplateEditorForm', () => {
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

  it('renders core fields and subsheets', () => {
    const sheet = makeBasicUnifiedSheet()

    render(
      <TemplateEditorForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
        session={null as never}
      />
    )

    expect(screen.getByText('Edit Template')).toBeInTheDocument()
    expect(screen.getByLabelText('Sheet Name')).toBeInTheDocument()
    expect(screen.getByText('Subsheet(s)')).toBeInTheDocument()
    expect(screen.getByText('Main')).toBeInTheDocument()
  })

  it('submits a PUT request with fieldValues and updated sheetName on success', async () => {
    const sheet = makeBasicUnifiedSheet()

    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sheetId: sheet.sheetId }),
    })

    render(
      <TemplateEditorForm
        defaultValues={sheet}
        areas={areas}
        manufacturers={manufacturers}
        suppliers={suppliers}
        categories={categories}
        clients={clients}
        projects={projects}
        session={null as never}
      />
    )

    const nameInput = screen.getByLabelText('Sheet Name')
    fireEvent.change(nameInput, { target: { value: 'Updated Template Name' } })

    const button = screen.getByRole('button', { name: /update template/i })
    fireEvent.click(button)

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0]

    expect(url).toBe(`/api/backend/templates/${sheet.sheetId}`)

    expect(options).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })

    const parsedBody = JSON.parse(options.body as string)

    expect(parsedBody.sheetName).toBe('Updated Template Name')
    expect(typeof parsedBody.fieldValues).toBe('object')
  })
})

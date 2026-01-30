// tests/ui/datasheets/TemplateEditorForm.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TemplateEditorForm from '../../../src/app/(admin)/datasheets/templates/[id]/edit/TemplateEditorForm'
import { getMockReferenceOptions, makeBasicUnifiedSheet, makeOptions } from './datasheetTestUtils'

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
    const fetchMock = jest.fn((url: string, init?: RequestInit) => {
      if (url.includes('reference-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => getMockReferenceOptions(),
        })
      }
      const putMatch = url.match(/^\/api\/backend\/templates\/(\d+)$/)
      if (putMatch != null && init?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sheetId: Number(putMatch[1]) }),
        })
      }
      return Promise.reject(new Error('Unexpected fetch: ' + url))
    })
    globalThis.fetch = fetchMock as typeof fetch
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders without throwing when session is null', () => {
    const sheet = makeBasicUnifiedSheet()

    expect(() => {
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
    }).not.toThrow()

    expect(screen.getByText('Edit Template')).toBeInTheDocument()
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
    expect(screen.getByDisplayValue('Test Sheet')).toBeInTheDocument()
    expect(screen.getByText('Subsheet Templates')).toBeInTheDocument()
  })

  it('submits a PUT request with fieldValues and updated sheetName on success', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('Discipline 1')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Test Sheet')
    fireEvent.change(nameInput, { target: { value: 'Updated Template Name' } })

    const button = screen.getByRole('button', { name: /save changes/i })
    fireEvent.click(button)

    await waitFor(() => {
      const putCall = (globalThis.fetch as jest.Mock).mock.calls.find(
        (call: [string, RequestInit]) =>
          call[0] === `/api/backend/templates/${sheet.sheetId}` && call[1]?.method === 'PUT'
      )
      expect(putCall).toBeDefined()
    })

    const putCall = (globalThis.fetch as jest.Mock).mock.calls.find(
      (call: [string, RequestInit]) =>
        call[0] === `/api/backend/templates/${sheet.sheetId}` && call[1]?.method === 'PUT'
    ) as [string, RequestInit]
    const [, options] = putCall
    expect(options).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    })
    const parsedBody = JSON.parse(options.body as string)
    expect(parsedBody.sheetName).toBe('Updated Template Name')
  })
})

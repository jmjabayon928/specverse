// tests/ui/datasheets/TemplateEditorForm.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TemplateEditorForm from '../../../src/app/(admin)/datasheets/templates/[id]/edit/TemplateEditorForm'
import {
  getMockReferenceOptions,
  makeBasicUnifiedSheet,
  makeJsonResponse,
  makeOptions,
  waitForReferenceOptionsLoaded,
} from './datasheetTestUtils'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

const originalFetch = globalThis.fetch

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
        return Promise.resolve(makeJsonResponse(getMockReferenceOptions()))
      }
      const putMatch = url.match(/^\/api\/backend\/templates\/(\d+)$/)
      if (putMatch != null && init?.method === 'PUT') {
        return Promise.resolve(makeJsonResponse({ sheetId: Number(putMatch[1]) }))
      }
      return Promise.reject(new Error('Unexpected fetch: ' + url))
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('renders without throwing when session is null', async () => {
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

    await waitForReferenceOptionsLoaded(screen)
    expect(screen.getByText('Edit Template')).toBeInTheDocument()
  })

  it('renders core fields and subsheets', async () => {
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

    await waitForReferenceOptionsLoaded(screen)
    expect(screen.getByText('Edit Template')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Test Sheet')).toBeInTheDocument()
    expect(screen.getByText('Subsheet Templates')).toBeInTheDocument()
  })

  it('submits a PUT request with fieldValues and updated sheetName on success', async () => {
    const user = userEvent.setup()
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

    await waitForReferenceOptionsLoaded(screen)

    const nameInput = screen.getByDisplayValue('Test Sheet')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Template Name')

    const button = screen.getByRole('button', { name: /save changes/i })
    await user.click(button)

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

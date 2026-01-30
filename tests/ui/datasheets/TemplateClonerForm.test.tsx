// tests/ui/datasheets/TemplateClonerForm.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import TemplateClonerForm from '../../../src/app/(admin)/datasheets/templates/[id]/clone/TemplateClonerForm'
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

describe('TemplateClonerForm', () => {
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
      if (url.includes('equipment-tag/check')) {
        return Promise.resolve(makeJsonResponse({ exists: false }))
      }
      if (url === '/api/backend/templates' && init?.method === 'POST') {
        return Promise.resolve(makeJsonResponse({ sheetId: 1234 }))
      }
      return Promise.reject(new Error('Unexpected fetch: ' + url))
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.resetAllMocks()
  })

  it('requires at least one subsheet and shows error if none', async () => {
    const user = userEvent.setup()
    const sheet = makeBasicUnifiedSheet()
    sheet.subsheets = []
    sheet.equipmentTagNum = ''

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

    await waitForReferenceOptionsLoaded(screen)

    const button = screen.getByRole('button', { name: /save new template/i })
    await user.click(button)

    const error = await screen.findByText(/at least one subsheet is required/i)
    expect(error).toBeInTheDocument()
    const postCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(
      (call: [string, RequestInit]) =>
        call[0] === '/api/backend/templates' && call[1]?.method === 'POST'
    )
    expect(postCalls).toHaveLength(0)
  })

  it('POSTs to /api/backend/templates on success', async () => {
    const user = userEvent.setup()
    const sheet = makeBasicUnifiedSheet()
    sheet.sheetId = 99
    sheet.disciplineId = 1

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

    await waitForReferenceOptionsLoaded(screen)

    const button = screen.getByRole('button', { name: /save new template/i })
    await user.click(button)

    await waitFor(() => {
      const postCall = (globalThis.fetch as jest.Mock).mock.calls.find(
        (call: [string, RequestInit]) =>
          call[0] === '/api/backend/templates' && call[1]?.method === 'POST'
      )
      expect(postCall).toBeDefined()
    })

    const postCall = (globalThis.fetch as jest.Mock).mock.calls.find(
      (call: [string, RequestInit]) =>
        call[0] === '/api/backend/templates' && call[1]?.method === 'POST'
    ) as [string, RequestInit]
    const [url, options] = postCall
    expect(url).toBe('/api/backend/templates')
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const parsedBody = JSON.parse(options.body as string)
    expect(parsedBody.disciplineId).toBe(1)
  })
})

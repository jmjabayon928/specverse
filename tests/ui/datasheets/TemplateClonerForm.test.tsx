// tests/ui/datasheets/TemplateClonerForm.test.tsx
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import TemplateClonerForm from '../../../src/app/(admin)/datasheets/templates/[id]/clone/TemplateClonerForm'
import { getMockReferenceOptions, makeBasicUnifiedSheet, makeOptions } from './datasheetTestUtils'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
  }),
}))

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
        return Promise.resolve({
          ok: true,
          json: async () => getMockReferenceOptions(),
        })
      }
      if (url.includes('equipment-tag/check')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ exists: false }),
        })
      }
      if (url === '/api/backend/templates' && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sheetId: 1234 }),
        })
      }
      return Promise.reject(new Error('Unexpected fetch: ' + url))
    })
    globalThis.fetch = fetchMock as typeof fetch
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('requires at least one subsheet and shows error if none', async () => {
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

    const button = screen.getByRole('button', { name: /save new template/i })
    fireEvent.click(button)

    const error = await screen.findByText(/at least one subsheet is required/i)
    expect(error).toBeInTheDocument()
    const postCalls = (globalThis.fetch as jest.Mock).mock.calls.filter(
      (call: [string, RequestInit]) =>
        call[0] === '/api/backend/templates' && call[1]?.method === 'POST'
    )
    expect(postCalls).toHaveLength(0)
  })

  it('POSTs to /api/backend/templates on success', async () => {
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

    await waitFor(() => {
      expect(screen.getByText('Discipline 1')).toBeInTheDocument()
    })

    const button = screen.getByRole('button', { name: /save new template/i })
    fireEvent.click(button)

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

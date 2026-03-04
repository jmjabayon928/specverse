import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import MelAssetsPageClient from '../../../src/components/assets/MelAssetsPageClient'
import { buildAssetsSearchParams } from '../../../src/utils/buildAssetsSearchParams'

const mockReplace = jest.fn()
let mockSearchParams = new URLSearchParams()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => '/assets',
  useSearchParams: () => mockSearchParams,
}))

function flushPromises(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('MelAssetsPageClient', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    mockReplace.mockClear()
    mockSearchParams = new URLSearchParams()
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  it('renders and fetches with initial params', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })

    render(<MelAssetsPageClient />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(async () => {
      await flushPromises()
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('/api/backend/assets?')
    expect(url).toContain('take=50')
    expect(url).toContain('skip=0')
  })

  it('typing in search then waiting debounce results in one request with collapsed q', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })

    const user = userEvent.setup()
    render(<MelAssetsPageClient />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(async () => {
      await flushPromises()
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    const searchInput = screen.getByLabelText(/search/i)
    await user.clear(searchInput)
    await user.type(searchInput, 'pump   station')

    await waitFor(
      async () => {
        await flushPromises()
        const calls = fetchMock.mock.calls.filter((c: [string]) =>
          String(c[0]).includes('/api/backend/assets')
        )
        const withQ = calls.find((c: [string]) => String(c[0]).includes('q=pump%20station'))
        expect(withQ).toBeDefined()
      },
      { timeout: 2000, interval: 100 }
    )
  })

  it('selecting criticality HIGH triggers request with criticality=HIGH', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })

    const user = userEvent.setup()
    render(<MelAssetsPageClient />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(async () => {
      await flushPromises()
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    const criticalitySelect = screen.getByLabelText(/criticality/i)
    await user.selectOptions(criticalitySelect, 'HIGH')

    await waitFor(
      async () => {
        await flushPromises()
        const calls = fetchMock.mock.calls.filter((c: [string]) =>
          String(c[0]).includes('/api/backend/assets')
        )
        const withHigh = calls.find((c: [string]) => String(c[0]).includes('criticality=HIGH'))
        expect(withHigh).toBeDefined()
      },
      { timeout: 2000, interval: 100 }
    )
  })

  it('clicking Next increments skip by take in URL', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    mockSearchParams = new URLSearchParams('take=50&skip=0')

    const user = userEvent.setup()
    const initialQueryString = buildAssetsSearchParams({ take: 50, skip: 0 })
    render(
      <MelAssetsPageClient
        initialParams={{ take: 50, skip: 0 }}
        initialQueryString={initialQueryString}
      />
    )

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(async () => {
      await flushPromises()
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })

    const nextBtn = screen.getByRole('button', { name: /next/i })
    await user.click(nextBtn)

    await waitFor(
      async () => {
        await flushPromises()
        const calls = fetchMock.mock.calls.filter((c: [string]) =>
          String(c[0]).includes('/api/backend/assets')
        )
        const withSkip50 = calls.find((c: [string]) => String(c[0]).includes('skip=50'))
        expect(withSkip50).toBeDefined()
      },
      { timeout: 2000, interval: 100 }
    )
  })

  it('changing a filter updates the URL with normalized param', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    mockSearchParams = new URLSearchParams('take=50&skip=0')
    const initialQueryString = buildAssetsSearchParams({ take: 50, skip: 0 })
    const user = userEvent.setup()
    render(
      <MelAssetsPageClient
        initialParams={{ take: 50, skip: 0 }}
        initialQueryString={initialQueryString}
      />
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(async () => {
      await flushPromises()
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument()
    })
    mockReplace.mockClear()

    const criticalitySelect = screen.getByLabelText(/criticality/i)
    await user.selectOptions(criticalitySelect, 'HIGH')

    await waitFor(
      async () => {
        await flushPromises()
        expect(mockReplace).toHaveBeenCalled()
        const callArg = mockReplace.mock.calls[0][0] as string
        expect(callArg).toContain('criticality=HIGH')
      },
      { timeout: 2000 }
    )
  })

  it('initial URL params are reflected in filter inputs on first render', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    mockSearchParams = new URLSearchParams('criticality=HIGH&take=25&skip=0')
    const initialParams = { criticality: 'HIGH', take: 25, skip: 0 }
    const initialQueryString = buildAssetsSearchParams(initialParams)
    render(
      <MelAssetsPageClient
        initialParams={initialParams}
        initialQueryString={initialQueryString}
      />
    )
    await waitFor(async () => {
      await flushPromises()
      const criticalitySelect = screen.getByLabelText(/criticality/i) as HTMLSelectElement
      const pageSizeSelect = screen.getByLabelText(/page size/i) as HTMLSelectElement
      expect(criticalitySelect.value).toBe('HIGH')
      expect(pageSizeSelect.value).toBe('25')
    })
  })
})

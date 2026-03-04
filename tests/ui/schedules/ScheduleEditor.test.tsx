// tests/ui/schedules/ScheduleEditor.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ScheduleEditor from '../../../src/components/schedules/ScheduleEditor'
import { clearAssetsCacheForTesting } from '../../../src/components/schedules/assetsCache'

const emptyDetail = {
  schedule: {
    scheduleId: 10,
    name: 'Test Schedule',
    scope: null,
    facilityId: null,
    spaceId: null,
    systemId: null,
    accountId: 1,
  },
  columns: [],
  entries: [],
  values: [],
}

const detailWithColumn = {
  ...emptyDetail,
  columns: [
    {
      scheduleColumnId: 1,
      columnKey: 'tag',
      columnLabel: 'Tag',
      dataType: 'string',
      isEditable: true,
    },
  ],
  entries: [],
  values: [],
}

const detailWithOneEntry = {
  ...emptyDetail,
  columns: [
    {
      scheduleColumnId: 1,
      columnKey: 'tag',
      columnLabel: 'Tag',
      dataType: 'string',
      isEditable: true,
    },
  ],
  entries: [
    {
      scheduleEntryId: 1,
      assetId: 100,
      sheetId: null,
      rowDataJson: null,
    },
  ],
  values: [],
}

describe('ScheduleEditor', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    fetchMock = jest.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    clearAssetsCacheForTesting()
  })

  it('renders empty schedule', () => {
    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={emptyDetail}
        fetchDetail={async () => emptyDetail}
      />
    )
    expect(screen.getByText('Test Schedule')).toBeInTheDocument()
    expect(screen.getByText('Columns')).toBeInTheDocument()
    expect(screen.getByText('Entries (asset-first)')).toBeInTheDocument()
  })

  it('add column and save columns calls fetch', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })
    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={emptyDetail}
        fetchDetail={async () => emptyDetail}
      />
    )

    const addCol = screen.getByRole('button', { name: /add column/i })
    await user.click(addCol)

    await waitFor(() => {
      expect(screen.getByDisplayValue('New column')).toBeInTheDocument()
    })

    const saveCol = screen.getByRole('button', { name: /save columns/i })
    await user.click(saveCol)

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        (c: [string, RequestInit]) => c[0].includes('/columns') && (c[1]?.method === 'PUT')
      )
      expect(putCalls.length).toBeGreaterThanOrEqual(1)
      expect(putCalls[0][0]).toMatch(/\/api\/backend\/schedules\/10\/columns/)
    })
  })

  it('add row triggers asset picker and save entries calls fetch', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [{ assetId: 1, assetTag: 'PT-001' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailWithColumn}
        fetchDetail={async () => detailWithColumn}
      />
    )

    const addRow = screen.getByRole('button', { name: /add row.*asset picker/i })
    await user.click(addRow)

    await waitFor(() => {
      const assetsCall = fetchMock.mock.calls.find(
        (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
      )
      expect(assetsCall).toBeDefined()
      expect(assetsCall![0]).toMatch(/\/api\/backend\/assets\?/)
      expect(assetsCall![0]).toContain('take=50')
      expect(assetsCall![0]).toContain('skip=0')
    })

    await waitFor(() => {
      expect(screen.getByText('PT-001')).toBeInTheDocument()
    })

    await user.click(screen.getByText('PT-001'))

    await waitFor(() => {
      expect(screen.getByText('PT-001')).toBeInTheDocument()
    })

    const saveEntries = screen.getByRole('button', { name: /save entries/i })
    await user.click(saveEntries)

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        (c: [string, RequestInit]) => c[0].includes('/entries') && (c[1]?.method === 'PUT')
      )
      expect(putCalls.length).toBeGreaterThanOrEqual(1)
      expect(putCalls[0][0]).toMatch(/\/api\/backend\/schedules\/10\/entries/)
    })
  })

  it('asset picker search includes q, take, and skip in URL', async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      if (u.includes('/api/backend/assets')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.reject(new Error(`Unmocked: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailWithColumn}
        fetchDetail={async () => detailWithColumn}
      />
    )

    await user.click(screen.getByRole('button', { name: /add row.*asset picker/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
      )
      expect(call).toBeDefined()
      expect(call![0]).toContain('take=50')
      expect(call![0]).toContain('skip=0')
    })

    const searchInput = await screen.findByPlaceholderText(/search by tag or name/i, { timeout: 2000 })
    await user.type(searchInput, 'pump')

    await waitFor(
      () => {
        const calls = fetchMock.mock.calls.filter(
          (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
        )
        const withQ = calls.find((c: [string]) => (c[0] as string).includes('q=pump'))
        expect(withQ).toBeDefined()
        expect(withQ![0]).toContain('take=50')
        expect(withQ![0]).toContain('skip=0')
      },
      { timeout: 8000, interval: 200 }
    )
  })

  it('asset picker criticality filter includes criticality=HIGH in URL', async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      if (u.includes('/api/backend/assets')) {
        return Promise.resolve({ ok: true, json: async () => [] })
      }
      return Promise.reject(new Error(`Unmocked: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailWithColumn}
        fetchDetail={async () => detailWithColumn}
      />
    )

    await user.click(screen.getByRole('button', { name: /add row.*asset picker/i }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(
        (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
      )
      expect(call).toBeDefined()
    })

    const criticalitySelect = await screen.findByLabelText(/criticality/i, { timeout: 2000 })
    await user.selectOptions(criticalitySelect, 'HIGH')

    await waitFor(
      () => {
        const calls = fetchMock.mock.calls.filter(
          (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
        )
        const withCriticality = calls.find((c: [string]) => (c[0] as string).includes('criticality=HIGH'))
        expect(withCriticality).toBeDefined()
      },
      { timeout: 8000, interval: 200 }
    )
  })

  it('asset picker in-flight dedupes identical requests across instances', async () => {
    type MockResponse = { ok: boolean; status: number; json: () => Promise<unknown> }
    let resolveAssets: (value: MockResponse) => void
    const assetsPromise = new Promise<MockResponse>(r => {
      resolveAssets = r
    })

    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      if (u.includes('/api/backend/assets')) return assetsPromise
      return Promise.reject(new Error(`Unmocked: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <div>
        <ScheduleEditor
          scheduleId={10}
          initialDetail={detailWithColumn}
          fetchDetail={async () => detailWithColumn}
        />
        <ScheduleEditor
          scheduleId={10}
          initialDetail={detailWithColumn}
          fetchDetail={async () => detailWithColumn}
        />
      </div>
    )

    const addRowButtons = screen.getAllByRole('button', { name: /add row.*asset picker/i })
    await user.click(addRowButtons[0])
    await user.click(addRowButtons[1])

    const inputs = await screen.findAllByPlaceholderText(/search by tag or name/i, { timeout: 2000 })
    expect(inputs.length).toBe(2)

    await waitFor(
      () => {
        const assetsCalls = fetchMock.mock.calls.filter(
          (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
        )
        expect(assetsCalls.length).toBe(1)
      },
      { timeout: 1500, interval: 100 }
    )

    resolveAssets({ ok: true, status: 200, json: async () => [] })
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
  })

  it('asset picker key normalization collapses spaces in q', async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      if (u.includes('/api/backend/assets')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.reject(new Error(`Unmocked: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailWithColumn}
        fetchDetail={async () => detailWithColumn}
      />
    )

    await user.click(screen.getByRole('button', { name: /add row.*asset picker/i }))

    const searchInput = await screen.findByPlaceholderText(/search by tag or name/i, { timeout: 2000 })
    await user.clear(searchInput)
    await user.type(searchInput, '  pump   station ')

    await waitFor(
      () => {
        const calls = fetchMock.mock.calls.filter(
          (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
        )
        const normalized = calls.find((c: [string]) => (c[0] as string).includes('q=pump%20station'))
        expect(normalized).toBeDefined()
      },
      { timeout: 8000, interval: 200 }
    )
  })

  it('asset picker cache is scoped by account so switching accounts does not reuse cached results', async () => {
    const detailAccount1 = {
      ...detailWithColumn,
      schedule: {
        ...detailWithColumn.schedule,
        accountId: 1,
      },
    }
    const detailAccount2 = {
      ...detailWithColumn,
      schedule: {
        ...detailWithColumn.schedule,
        accountId: 2,
      },
    }

    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      if (u.includes('/api/backend/assets')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] })
      }
      return Promise.reject(new Error(`Unmocked: ${u}`))
    })

    const user = userEvent.setup()

    const { unmount } = render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailAccount1}
        fetchDetail={async () => detailAccount1}
      />
    )

    await user.click(screen.getByRole('button', { name: /add row.*asset picker/i }))
    const searchInput1 = await screen.findByPlaceholderText(/search by tag or name/i, { timeout: 2000 })
    await user.clear(searchInput1)
    await user.type(searchInput1, 'pump')

    await waitFor(
      () => {
        const calls = fetchMock.mock.calls.filter(
          (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
        )
        const scoped = calls.find((c: [string]) => (c[0] as string).includes('scope=1') && (c[0] as string).includes('q=pump'))
        expect(scoped).toBeDefined()
      },
      { timeout: 8000, interval: 200 }
    )

    unmount()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailAccount2}
        fetchDetail={async () => detailAccount2}
      />
    )

    await user.click(screen.getByRole('button', { name: /add row.*asset picker/i }))
    const searchInput2 = await screen.findByPlaceholderText(/search by tag or name/i, { timeout: 2000 })
    await user.clear(searchInput2)
    await user.type(searchInput2, 'pump')

    await waitFor(
      () => {
        const calls = fetchMock.mock.calls.filter(
          (c: [string, RequestInit]) => typeof c[0] === 'string' && c[0].includes('/api/backend/assets')
        )
        const pumpCalls = calls.filter((c: [string]) => (c[0] as string).includes('q=pump'))
        expect(pumpCalls.length).toBeGreaterThanOrEqual(2)
        const scoped2 = pumpCalls.find((c: [string]) => (c[0] as string).includes('scope=2'))
        expect(scoped2).toBeDefined()
      },
      { timeout: 8000, interval: 200 }
    )
  })

  it('asset picker shows explicit auth/permission message on 401 and clears it after a successful fetch', async () => {
    let assetsCallCount = 0
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      if (!u.includes('/api/backend/assets')) return Promise.reject(new Error(`Unmocked: ${u}`))
      assetsCallCount += 1
      if (assetsCallCount === 1) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({}) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => [{ assetId: 1, assetTag: 'PT-001' }] })
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailWithColumn}
        fetchDetail={async () => detailWithColumn}
      />
    )

    await user.click(screen.getByRole('button', { name: /add row.*asset picker/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/session expired or insufficient permissions/i)
      ).toBeInTheDocument()
    })

    const searchInput = await screen.findByPlaceholderText(/search by tag or name/i, { timeout: 2000 })
    await user.clear(searchInput)
    await user.type(searchInput, 'pump')

    await waitFor(
      () => {
        expect(screen.queryByText(/session expired or insufficient permissions/i)).not.toBeInTheDocument()
        expect(screen.getByText('PT-001')).toBeInTheDocument()
      },
      { timeout: 8000, interval: 200 }
    )
  })

  it('sheet picker: search and select links datasheet to row', async () => {
    fetchMock.mockImplementation((url: string | URL | Request) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      if (u.includes('/sheet-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { sheetId: 42, sheetName: 'Pump Datasheet', status: 'Verified', disciplineName: 'Mech', subtypeName: 'Pump' },
            ],
            total: 1,
          }),
        })
      }
      return Promise.reject(new Error(`Unmocked fetch: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={detailWithOneEntry}
        fetchDetail={async () => detailWithOneEntry}
      />
    )

    const linkBtn = screen.getByRole('button', { name: /link datasheet/i })
    await user.click(linkBtn)

    const searchInput = screen.getByLabelText(/search datasheets/i)
    await user.type(searchInput, 'pump')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/backend\/schedules\/sheet-options\?q=pump/),
        expect.any(Object)
      )
    })

    await waitFor(() => {
      expect(screen.getByText('Pump Datasheet')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Pump Datasheet'))

    await waitFor(() => {
      expect(screen.getByText(/Pump Datasheet/)).toBeInTheDocument()
    })
  })

  it('facility selection enables space/system search inputs', async () => {
    fetchMock.mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      const method = init?.method || (typeof url === 'object' && 'method' in url ? url.method : 'GET')
      if (u.includes('/facility-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { facilityId: 1, facilityName: 'Building A' },
            ],
            total: 1,
          }),
        })
      }
      if (u.includes('/space-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { spaceId: 1, spaceName: 'Room 101' },
            ],
            total: 1,
          }),
        })
      }
      if (u.includes('/system-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { systemId: 1, systemName: 'HVAC System' },
            ],
            total: 1,
          }),
        })
      }
      if (u.includes('/schedules/10') && method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true }),
        })
      }
      return Promise.reject(new Error(`Unmocked fetch: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={emptyDetail}
        fetchDetail={async () => emptyDetail}
      />
    )

    // Click "Select Facility"
    const selectFacilityBtn = screen.getByRole('button', { name: /select facility/i })
    await user.click(selectFacilityBtn)

    // Type in facility search
    const facilitySearchInput = screen.getByPlaceholderText(/search facilities/i)
    await user.type(facilitySearchInput, 'building')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/backend\/schedules\/facility-options\?q=building/),
        expect.any(Object)
      )
    })

    // Select facility
    await waitFor(() => {
      expect(screen.getByText('Building A')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Building A'))

    // After facility selected, space/system buttons should be enabled
    await waitFor(() => {
      const spaceBtn = screen.getByRole('button', { name: /select space/i })
      const systemBtn = screen.getByRole('button', { name: /select system/i })
      expect(spaceBtn).not.toBeDisabled()
      expect(systemBtn).not.toBeDisabled()
    })
  })

  it('coalesces metadata PATCHes so rapid facility then space selection sends 2 PATCHes with second containing both', async () => {
    const patchCalls: { body: unknown }[] = []
    let resolveFirstPatch: () => void
    const firstPatchPromise = new Promise<void>(r => {
      resolveFirstPatch = r
    })

    fetchMock.mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      const method = init?.method || (typeof url === 'object' && url && 'method' in url ? (url as Request).method : 'GET')
      if (u.includes('/facility-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [{ facilityId: 1, facilityName: 'Building A' }], total: 1 }),
        })
      }
      if (u.includes('/space-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [{ spaceId: 1, spaceName: 'Room 101' }], total: 1 }),
        })
      }
      if (u.includes('/schedules/10') && method === 'PATCH') {
        const body = init?.body ? JSON.parse(init.body as string) : {}
        patchCalls.push({ body })
        if (patchCalls.length === 1) {
          return firstPatchPromise.then(() => ({ ok: true, json: async () => ({}) }))
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      return Promise.reject(new Error(`Unmocked fetch: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={emptyDetail}
        fetchDetail={async () => emptyDetail}
      />
    )

    await user.click(screen.getByRole('button', { name: /select facility/i }))
    const facilitySearchInput = screen.getByPlaceholderText(/search facilities/i)
    await user.type(facilitySearchInput, 'building')
    await waitFor(() => expect(screen.getByText('Building A')).toBeInTheDocument())
    await user.click(screen.getByText('Building A'))

    await waitFor(() => expect(screen.getByRole('button', { name: /select space/i })).not.toBeDisabled())
    await user.click(screen.getByRole('button', { name: /select space/i }))
    const spaceSearchInput = screen.getByPlaceholderText(/search spaces/i)
    await user.type(spaceSearchInput, 'room')
    await waitFor(() => expect(screen.getByText('Room 101')).toBeInTheDocument())
    await user.click(screen.getByText('Room 101'))

    resolveFirstPatch!()
    await waitFor(() => expect(patchCalls.length).toBe(2))
    expect(patchCalls[0].body).toEqual({ facilityId: 1, spaceId: null, systemId: null })
    expect(patchCalls[1].body).toEqual({ facilityId: 1, spaceId: 1, systemId: null })
  })

  it('surfaces metadata save error and clears it on next successful save', async () => {
    let patchCallCount = 0
    fetchMock.mockImplementation((url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url instanceof Request ? url.url : String(url)
      const method = init?.method || (typeof url === 'object' && url && 'method' in url ? (url as Request).method : 'GET')
      if (u.includes('/facility-options')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: [{ facilityId: 1, facilityName: 'Building A' }], total: 1 }),
        })
      }
      if (u.includes('/schedules/10') && method === 'PATCH') {
        patchCallCount++
        if (patchCallCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => 'Server error',
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      }
      return Promise.reject(new Error(`Unmocked fetch: ${u}`))
    })

    const user = userEvent.setup()

    render(
      <ScheduleEditor
        scheduleId={10}
        initialDetail={emptyDetail}
        fetchDetail={async () => emptyDetail}
      />
    )

    await user.click(screen.getByRole('button', { name: /select facility/i }))
    await user.type(screen.getByPlaceholderText(/search facilities/i), 'building')
    await waitFor(() => expect(screen.getByText('Building A')).toBeInTheDocument())
    await user.click(screen.getByText('Building A'))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Server error'))

    await user.click(screen.getByRole('button', { name: /change/i }))
    await user.type(screen.getByPlaceholderText(/search facilities/i), 'building')
    await waitFor(() => expect(screen.getByText('Building A')).toBeInTheDocument())
    await user.click(screen.getByText('Building A'))

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })
})

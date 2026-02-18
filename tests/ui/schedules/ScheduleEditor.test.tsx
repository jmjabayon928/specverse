// tests/ui/schedules/ScheduleEditor.test.tsx
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import ScheduleEditor from '../../../src/components/schedules/ScheduleEditor'

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
    const origPrompt = globalThis.window.prompt
    globalThis.window.prompt = jest.fn(() => 'PT')

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
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/backend\/assets\?q=/),
        expect.any(Object)
      )
    })

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

    globalThis.window.prompt = origPrompt
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

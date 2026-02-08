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
})

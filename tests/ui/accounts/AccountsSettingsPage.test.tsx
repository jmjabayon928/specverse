import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AccountsTable from '../../../src/app/(admin)/settings/accounts/AccountsTable'

const toastSuccess = jest.fn()
const toastError = jest.fn()

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}))

describe('Accounts settings UI', () => {
  beforeEach(() => {
    toastSuccess.mockClear()
    toastError.mockClear()
    ;(global as any).fetch = jest.fn()
  })

  test('renders rows and can create a new account', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ accountId: 2, accountName: 'New Account', slug: 'new-account', isActive: true }),
    })

    render(
      <AccountsTable
        initialAccounts={[
          { accountId: 1, accountName: 'Default Account', slug: 'default', isActive: true },
        ]}
      />,
    )

    expect(screen.getByText('Default Account')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ New Account' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ New Account' }))

    fireEvent.change(screen.getByLabelText('Account Name'), { target: { value: 'New Account' } })
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'new-account' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await waitFor(() => expect(screen.getByText('New Account')).toBeInTheDocument())
  })

  test('disables submit during in-flight request and re-enables after 400', async () => {
    const fetchMock = global.fetch as unknown as jest.Mock

    type FetchResponse = { ok: boolean; status: number; json: () => Promise<{ message?: string }> }

    let resolveFetch!: (value: FetchResponse) => void
    const deferred: Promise<FetchResponse> = new Promise<FetchResponse>((resolve) => {
      resolveFetch = resolve
    })
    fetchMock.mockImplementationOnce(() => deferred)

    render(
      <AccountsTable
        initialAccounts={[
          { accountId: 1, accountName: 'Default Account', slug: 'default', isActive: true },
        ]}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '+ New Account' }))
    fireEvent.change(screen.getByLabelText('Account Name'), { target: { value: 'Bad' } })
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'bad-slug' } })

    const submitBtn = screen.getByRole('button', { name: 'Create' })
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled())

    resolveFetch({
      ok: false,
      status: 400,
      json: async () => ({ message: 'accountName must be non-empty' }),
    })

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('accountName must be non-empty'))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled())
  })
})


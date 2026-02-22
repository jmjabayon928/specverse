import React from 'react'
import { render, screen } from '@testing-library/react'
import { ReactErrorBoundary } from '../../src/components/error/ReactErrorBoundary'

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ReactErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    jest.restoreAllMocks()
  })

  it('logs error details when child throws during render', () => {
    const route = '/dashboard'
    const buildId = 'test-build-123'
    const userId = 42

    render(
      <ReactErrorBoundary route={route} buildId={buildId} userId={userId}>
        <ThrowError shouldThrow={true} />
      </ReactErrorBoundary>
    )

    const loggedCall = consoleErrorSpy.mock.calls.find(
      (call) => call[0] && typeof call[0] === 'object' && call[0].route === '/dashboard'
    )
    expect(loggedCall).toBeDefined()
    const loggedObject = loggedCall[0]

    expect(loggedObject).toMatchObject({
      message: 'Test error',
      route: '/dashboard',
      buildId: 'test-build-123',
      userId: 42,
      errorName: 'Error',
    })

    expect(loggedObject.stack).toBeTruthy()
    expect(typeof loggedObject.stack).toBe('string')
    expect(loggedObject.componentStack).toBeTruthy()
    expect(typeof loggedObject.componentStack).toBe('string')
    expect(loggedObject.componentStack.length).toBeGreaterThan(0)
    expect(loggedObject.timestamp).toEqual(expect.any(String))
  })

  it('handles null userId correctly', () => {
    const route = '/login'
    const buildId = 'local'
    const userId = null

    render(
      <ReactErrorBoundary route={route} buildId={buildId} userId={userId}>
        <ThrowError shouldThrow={true} />
      </ReactErrorBoundary>
    )

    const loggedCall = consoleErrorSpy.mock.calls.find(
      (call) => call[0] && typeof call[0] === 'object' && call[0].route === '/login'
    )
    expect(loggedCall).toBeDefined()
    const loggedObject = loggedCall[0]
    expect(loggedObject.userId).toBeNull()
    expect(loggedObject.route).toBe('/login')
    expect(loggedObject.buildId).toBe('local')
    expect(loggedObject.errorName).toBe('Error')
    expect(loggedObject.timestamp).toEqual(expect.any(String))
  })

  it('renders fallback UI when error occurs', () => {
    const route = '/test-route'
    const buildId = 'test-build'
    const userId = 1

    render(
      <ReactErrorBoundary route={route} buildId={buildId} userId={userId}>
        <ThrowError shouldThrow={true} />
      </ReactErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/Route: \/test-route/)).toBeInTheDocument()
    expect(screen.getByText('Reload')).toBeInTheDocument()
  })

  it('renders children normally when no error occurs', () => {
    const route = '/dashboard'
    const buildId = 'test-build'
    const userId = 1

    render(
      <ReactErrorBoundary route={route} buildId={buildId} userId={userId}>
        <ThrowError shouldThrow={false} />
      </ReactErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})

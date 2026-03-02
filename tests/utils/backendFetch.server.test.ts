import {
  buildAbsoluteUrl,
  inferProtocol,
} from '../../src/utils/backendFetch.server'

describe('buildAbsoluteUrl', () => {
  it('builds absolute URL from path and parts', () => {
    expect(
      buildAbsoluteUrl('/api/backend/x', { protocol: 'https', host: 'example.com' })
    ).toBe('https://example.com/api/backend/x')
  })

  it('prefixes path with / when input does not start with /', () => {
    expect(
      buildAbsoluteUrl('api/backend/x', { protocol: 'https', host: 'example.com' })
    ).toBe('https://example.com/api/backend/x')
  })

  it('returns absolute https input unchanged', () => {
    expect(
      buildAbsoluteUrl('https://foo.com/a', { protocol: 'https', host: 'example.com' })
    ).toBe('https://foo.com/a')
  })

  it('returns absolute http input unchanged', () => {
    expect(
      buildAbsoluteUrl('http://foo.com/a', { protocol: 'https', host: 'example.com' })
    ).toBe('http://foo.com/a')
  })

  it('preserves query string', () => {
    expect(
      buildAbsoluteUrl('/api/backend/x?y=1', { protocol: 'https', host: 'example.com' })
    ).toBe('https://example.com/api/backend/x?y=1')
  })
})

describe('inferProtocol', () => {
  it('uses x-forwarded-proto when present (http)', () => {
    expect(inferProtocol('example.com', 'http')).toBe('http')
  })

  it('uses x-forwarded-proto when present (https)', () => {
    expect(inferProtocol('example.com', 'https')).toBe('https')
  })

  it('defaults to https when x-forwarded-proto is empty string', () => {
    expect(inferProtocol('example.com', '')).toBe('https')
  })

  it('defaults to https when x-forwarded-proto is null', () => {
    expect(inferProtocol('example.com', null)).toBe('https')
  })

  it('returns http when host includes localhost and no x-forwarded-proto', () => {
    expect(inferProtocol('localhost', null)).toBe('http')
    expect(inferProtocol('localhost:3000', null)).toBe('http')
  })

  it('returns http when host includes 127.0.0.1 and no x-forwarded-proto', () => {
    expect(inferProtocol('127.0.0.1', null)).toBe('http')
    expect(inferProtocol('127.0.0.1:3000', null)).toBe('http')
  })

  it('returns https for other hosts when no x-forwarded-proto', () => {
    expect(inferProtocol('vps.example.com', null)).toBe('https')
  })
})

import { buildAssetsSearchParams } from '../../../src/utils/buildAssetsSearchParams'

describe('buildAssetsSearchParams', () => {
  it('collapses spaces in q', () => {
    const qs = buildAssetsSearchParams({ q: ' pump   station ', take: 50, skip: 0 })
    expect(qs).toContain('q=pump%20station')
    expect(qs).toContain('take=50')
    expect(qs).toContain('skip=0')
  })

  it('drops empty strings (location trim to empty not included)', () => {
    const qs = buildAssetsSearchParams({ location: '   ', take: 50, skip: 0 })
    expect(qs).not.toContain('location=')
    expect(qs).toContain('take=50')
  })

  it('uppercases criticality', () => {
    const qs = buildAssetsSearchParams({ criticality: 'high', take: 50, skip: 0 })
    expect(qs).toContain('criticality=HIGH')
  })

  it('clamps take to 200 and skip to 0', () => {
    const qs = buildAssetsSearchParams({ take: 999, skip: -5 })
    expect(qs).toContain('take=200')
    expect(qs).toContain('skip=0')
  })
})

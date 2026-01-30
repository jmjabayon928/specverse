import { normalizeCategoryContribution, hasNoUsableData } from '../../src/app/(admin)/dashboard/reports/chartDataUtils'

describe('normalizeCategoryContribution', () => {
  it('returns empty array for null input', () => {
    expect(normalizeCategoryContribution(null)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(normalizeCategoryContribution(undefined)).toEqual([])
  })

  it('returns empty array for non-array input', () => {
    expect(normalizeCategoryContribution({} as never)).toEqual([])
  })

  it('treats items: null as empty items array and does not throw', () => {
    const raw: unknown = [{ categoryName: 'A', items: null }]
    const result = normalizeCategoryContribution(raw)
    expect(result).toHaveLength(1)
    expect(result[0].categoryName).toBe('A')
    expect(result[0].items).toEqual([])
  })

  it('treats missing items as empty items array and does not throw', () => {
    const raw = [{ categoryName: 'B' }] as never[]
    const result = normalizeCategoryContribution(raw)
    expect(result).toHaveLength(1)
    expect(result[0].categoryName).toBe('B')
    expect(result[0].items).toEqual([])
  })

  it('treats items as object (non-array) as empty items array', () => {
    const raw = [{ categoryName: 'C', items: { x: 1 } }] as never[]
    const result = normalizeCategoryContribution(raw)
    expect(result).toHaveLength(1)
    expect(result[0].items).toEqual([])
  })

  it('produces valid chart rows for well-formed input', () => {
    const raw = [
      { categoryName: 'Pipes', items: [{ itemName: 'Steel Pipe', quantity: 100 }] },
      { categoryName: 'Valves', items: [] },
    ]
    const result = normalizeCategoryContribution(raw)
    expect(result).toHaveLength(2)
    expect(result[0].categoryName).toBe('Pipes')
    expect(result[0].items).toHaveLength(1)
    expect(result[0].items[0]).toEqual({ itemName: 'Steel Pipe', quantity: 100 })
    expect(result[1].categoryName).toBe('Valves')
    expect(result[1].items).toEqual([])
  })
})

describe('hasNoUsableData', () => {
  it('returns true for empty array', () => {
    expect(hasNoUsableData([])).toBe(true)
  })

  it('returns true when every category has items.length === 0', () => {
    expect(hasNoUsableData([{ categoryName: 'A', items: [] }])).toBe(true)
    expect(
      hasNoUsableData([
        { categoryName: 'A', items: [] },
        { categoryName: 'B', items: [] },
      ])
    ).toBe(true)
  })

  it('returns false when at least one category has items', () => {
    expect(
      hasNoUsableData([{ categoryName: 'A', items: [{ itemName: 'x', quantity: 1 }] }])
    ).toBe(false)
    expect(
      hasNoUsableData([
        { categoryName: 'A', items: [] },
        { categoryName: 'B', items: [{ itemName: 'y', quantity: 2 }] },
      ])
    ).toBe(false)
  })
})

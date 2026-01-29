import { diffUnifiedSheets } from '@/domain/datasheets/revisionDiff'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'

function makeSheet(overrides?: Partial<UnifiedSheet>): UnifiedSheet {
  return {
    sheetName: 'S',
    sheetDesc: 'D',
    areaId: 1,
    manuId: 1,
    suppId: 1,
    categoryId: 1,
    clientId: 1,
    projectId: 1,
    clientDocNum: 1,
    clientProjectNum: 1,
    companyDocNum: 1,
    companyProjectNum: 1,
    revisionNum: 1,
    revisionDate: '2026-01-01',
    equipmentName: 'E',
    equipmentTagNum: 'T',
    serviceName: 'Svc',
    requiredQty: 1,
    itemLocation: 'Loc',
    equipSize: 1,
    preparedById: 1,
    preparedByDate: '2026-01-01',
    packageName: 'P',
    subsheets: [
      {
        id: 10,
        originalId: 10,
        name: 'Main',
        fields: [
          {
            id: 1001,
            originalId: 5001,
            label: 'Design Pressure',
            infoType: 'decimal',
            sortOrder: 1,
            required: true,
            options: [],
            value: '10',
          },
          {
            id: 1002,
            originalId: 5002,
            label: 'Design Temperature',
            infoType: 'decimal',
            sortOrder: 2,
            required: false,
            options: [],
            value: '100',
          },
        ],
      },
    ],
    informationValues: {},
    ...overrides,
  }
}

describe('diffUnifiedSheets', () => {
  it('returns zero changed/added/removed when sheets are identical', () => {
    const a = makeSheet()
    const b = makeSheet()

    const result = diffUnifiedSheets(a, b)

    expect(result.counts.changed).toBe(0)
    expect(result.counts.added).toBe(0)
    expect(result.counts.removed).toBe(0)
    expect(result.rows.filter(r => r.kind !== 'unchanged')).toHaveLength(0)
  })

  it('detects a single changed field value', () => {
    const a = makeSheet()
    const b = makeSheet({
      subsheets: [
        {
          id: 10,
          originalId: 10,
          name: 'Main',
          fields: [
            {
              id: 1001,
              originalId: 5001,
              label: 'Design Pressure',
              infoType: 'decimal',
              sortOrder: 1,
              required: true,
              options: [],
              value: '11',
            },
            {
              id: 1002,
              originalId: 5002,
              label: 'Design Temperature',
              infoType: 'decimal',
              sortOrder: 2,
              required: false,
              options: [],
              value: '100',
            },
          ],
        },
      ],
    })

    const result = diffUnifiedSheets(a, b)
    const changedRows = result.rows.filter(r => r.kind === 'changed')

    expect(changedRows).toHaveLength(1)
    expect(changedRows[0].label).toBe('Design Pressure')
    expect(changedRows[0].oldValue).toBe('10')
    expect(changedRows[0].newValue).toBe('11')
  })

  it('marks field present only in B as added', () => {
    const a = makeSheet({
      subsheets: [
        {
          id: 10,
          originalId: 10,
          name: 'Main',
          fields: [
            {
              id: 1001,
              originalId: 5001,
              label: 'Design Pressure',
              infoType: 'decimal',
              sortOrder: 1,
              required: true,
              options: [],
              value: '10',
            },
          ],
        },
      ],
    })

    const b = makeSheet()

    const result = diffUnifiedSheets(a, b)
    const addedRows = result.rows.filter(r => r.kind === 'added')

    expect(addedRows).toHaveLength(1)
    expect(addedRows[0].label).toBe('Design Temperature')
    expect(addedRows[0].oldValue).toBe('')
    expect(addedRows[0].newValue).toBe('100')
  })

  it('marks field present only in A as removed', () => {
    const a = makeSheet()
    const b = makeSheet({
      subsheets: [
        {
          id: 10,
          originalId: 10,
          name: 'Main',
          fields: [
            {
              id: 1001,
              originalId: 5001,
              label: 'Design Pressure',
              infoType: 'decimal',
              sortOrder: 1,
              required: true,
              options: [],
              value: '10',
            },
          ],
        },
      ],
    })

    const result = diffUnifiedSheets(a, b)
    const removedRows = result.rows.filter(r => r.kind === 'removed')

    expect(removedRows).toHaveLength(1)
    expect(removedRows[0].label).toBe('Design Temperature')
    expect(removedRows[0].oldValue).toBe('100')
    expect(removedRows[0].newValue).toBe('')
  })

  it('is order-independent for subsheets and fields', () => {
    const a = makeSheet({
      subsheets: [
        {
          id: 11,
          originalId: 11,
          name: 'Secondary',
          fields: [
            {
              id: 2001,
              originalId: 6001,
              label: 'Foo',
              infoType: 'varchar',
              sortOrder: 1,
              required: false,
              options: [],
              value: 'A',
            },
          ],
        },
        ...makeSheet().subsheets,
      ],
    })

    const b = makeSheet({
      subsheets: [
        {
          id: 10,
          originalId: 10,
          name: 'Main',
          fields: [
            // swapped order of fields
            {
              id: 1002,
              originalId: 5002,
              label: 'Design Temperature',
              infoType: 'decimal',
              sortOrder: 2,
              required: false,
              options: [],
              value: '100',
            },
            {
              id: 1001,
              originalId: 5001,
              label: 'Design Pressure',
              infoType: 'decimal',
              sortOrder: 1,
              required: true,
              options: [],
              value: '10',
            },
          ],
        },
        {
          id: 11,
          originalId: 11,
          name: 'Secondary',
          fields: [
            {
              id: 2001,
              originalId: 6001,
              label: 'Foo',
              infoType: 'varchar',
              sortOrder: 1,
              required: false,
              options: [],
              value: 'A',
            },
          ],
        },
      ],
    })

    const result = diffUnifiedSheets(a, b)

    expect(result.counts.changed).toBe(0)
    expect(result.counts.added).toBe(0)
    expect(result.counts.removed).toBe(0)
    expect(result.rows.filter(r => r.kind !== 'unchanged')).toHaveLength(0)
  })
})


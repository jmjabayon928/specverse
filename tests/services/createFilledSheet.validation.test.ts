// tests/services/createFilledSheet.validation.test.ts
// Real validation path: validateFilledValues with shapes used by createFilledSheet (fieldMeta + values keyed by infoTemplateId).

import {
  validateFilledValues,
  type FilledFieldMeta,
} from '../../src/backend/services/filledSheetService'

/** Build meta in same shape as createFilledSheet's buildFieldMetaByInfoTemplateId (from template + options). */
function meta(overrides: Partial<FilledFieldMeta> = {}): FilledFieldMeta {
  return {
    required: false,
    label: '',
    infoType: 'varchar',
    options: [],
    ...overrides,
  }
}

describe('createFilledSheet validation (validateFilledValues)', () => {
  it('decimal accepts "2" and "2.0"', () => {
    const fieldMetaByInfoTemplateId: Record<number, FilledFieldMeta> = {
      3792: meta({ infoType: 'decimal', required: false }),
      3795: meta({ infoType: 'decimal', required: false }),
    }
    const values: Record<string, string> = { '3792': '2', '3795': '2.0' }
    const errors = validateFilledValues(fieldMetaByInfoTemplateId, values)
    expect(errors).toHaveLength(0)
  })

  it('options accept "D" when options include "D " (trim)', () => {
    const fieldMetaByInfoTemplateId: Record<number, FilledFieldMeta> = {
      3797: meta({ infoType: 'varchar', required: false, options: ['D ', 'E', 'F'] }),
    }
    const values: Record<string, string> = { '3797': 'D' }
    const errors = validateFilledValues(fieldMetaByInfoTemplateId, values)
    expect(errors).toHaveLength(0)
  })

  it('decimal rejects "abc" with fieldErrors containing infoTemplateId', () => {
    const infoTemplateId = 3792
    const fieldMetaByInfoTemplateId: Record<number, FilledFieldMeta> = {
      [infoTemplateId]: meta({ infoType: 'decimal', required: false, label: 'Information_dec' }),
    }
    const values: Record<string, string> = { [String(infoTemplateId)]: 'abc' }
    const errors = validateFilledValues(fieldMetaByInfoTemplateId, values)
    expect(errors).toHaveLength(1)
    expect(errors[0].infoTemplateId).toBe(infoTemplateId)
    expect(errors[0].message).toBe('Enter a number.')
  })
})

// tests/services/validateFilledValues.test.ts
import {
  validateFilledValues,
  type FilledFieldMeta,
} from '../../src/backend/services/filledSheetService'

function meta(overrides: Partial<FilledFieldMeta> = {}): FilledFieldMeta {
  return {
    required: false,
    label: 'Test',
    infoType: 'varchar',
    options: [],
    ...overrides,
  }
}

describe('validateFilledValues', () => {
  it('int + "abc" fails with "Enter a whole number."', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'int', required: false }),
    }
    const values: Record<string, string> = { '1': 'abc' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(1)
    expect(errors[0].infoTemplateId).toBe(1)
    expect(errors[0].message).toBe('Enter a whole number.')
  })

  it('int + "12.5" fails with "Enter a whole number."', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'int', required: false }),
    }
    const values: Record<string, string> = { '1': '12.5' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Enter a whole number.')
  })

  it('int + "12" passes', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'int', required: false }),
    }
    const values: Record<string, string> = { '1': '12' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(0)
  })

  it('decimal + "abc" fails with "Enter a number."', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'decimal', required: false }),
    }
    const values: Record<string, string> = { '1': 'abc' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Enter a number.')
  })

  it('decimal + "12.5" passes', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'decimal', required: false }),
    }
    const values: Record<string, string> = { '1': '12.5' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(0)
  })

  it('options ["A","B"], value "C" fails with "Choose a valid option." and includes optionsPreview/optionsCount', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'varchar', required: false, options: ['A', 'B'] }),
    }
    const values: Record<string, string> = { '1': 'C' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Choose a valid option.')
    expect(errors[0].optionsPreview).toEqual(['A', 'B'])
    expect(errors[0].optionsCount).toBe(2)
  })

  it('options ["A","B"], value "  A  " passes (trimmed comparison)', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'varchar', required: false, options: ['A', 'B'] }),
    }
    const values: Record<string, string> = { '1': '  A  ' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(0)
  })

  it('options ["A","B"], value "A" passes', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'varchar', required: false, options: ['A', 'B'] }),
    }
    const values: Record<string, string> = { '1': 'A' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(0)
  })

  it('required + empty string fails with "This field is required."', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ required: true, infoType: 'varchar' }),
    }
    const values: Record<string, string> = { '1': '' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('This field is required.')
  })

  it('required + whitespace fails', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ required: true, infoType: 'varchar' }),
    }
    const values: Record<string, string> = { '1': '   ' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('This field is required.')
  })
})

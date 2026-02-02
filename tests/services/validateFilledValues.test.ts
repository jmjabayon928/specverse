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

  it('decimal accepts "2" and "2.0"', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'decimal', required: false }),
    }
    expect(validateFilledValues(fieldMeta, { '1': '2' })).toHaveLength(0)
    expect(validateFilledValues(fieldMeta, { '1': '2.0' })).toHaveLength(0)
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

  it('options compare trims both sides: meta.options = ["D ", "E", "F"], value = "D" passes', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      1: meta({ infoType: 'varchar', required: false, options: ['D ', 'E', 'F'] }),
    }
    const values: Record<string, string> = { '1': 'D' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(0)
  })

  it('key lookup uses String(infoTemplateId): values = { "3792": "2" } found for infoTemplateId 3792', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      3792: meta({ infoType: 'decimal', required: false }),
    }
    const values: Record<string, string> = { '3792': '2' }
    const errors = validateFilledValues(fieldMeta, values)
    expect(errors).toHaveLength(0)
  })

  it('real IDs 3792/3795/3796/3797: decimals "2" and options "A"/"D" pass with exact meta', () => {
    const fieldMeta: Record<number, FilledFieldMeta> = {
      3792: meta({ infoType: 'decimal', required: false }),
      3795: meta({ infoType: 'decimal', required: false }),
      3796: meta({ infoType: 'varchar', required: false, options: ['A', 'B', 'C'] }),
      3797: meta({ infoType: 'varchar', required: false, options: ['D', 'E', 'F'] }),
    }
    const valuesKeyedByTemplateId: Record<string, string> = {
      '3792': '2',
      '3795': '2',
      '3796': 'A',
      '3797': 'D',
    }
    const errors = validateFilledValues(fieldMeta, valuesKeyedByTemplateId)
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

// tests/utils/numericFieldHelpers.test.ts
import {
  normalizeNumericInput,
  isFiniteNumericString,
  getNumericFieldError,
} from '../../src/utils/numericFieldHelpers'

describe('numericFieldHelpers', () => {
  describe('normalizeNumericInput', () => {
    it('returns empty string for blank or whitespace', () => {
      expect(normalizeNumericInput('')).toBe('')
      expect(normalizeNumericInput('   ')).toBe('')
      expect(normalizeNumericInput('\t')).toBe('')
    })

    it('returns trimmed string for finite numbers', () => {
      expect(normalizeNumericInput('0')).toBe('0')
      expect(normalizeNumericInput('42')).toBe('42')
      expect(normalizeNumericInput('  -1.5  ')).toBe('-1.5')
      expect(normalizeNumericInput('3.14')).toBe('3.14')
    })

    it('returns empty string for non-numeric input', () => {
      expect(normalizeNumericInput('varchar12')).toBe('')
      expect(normalizeNumericInput('abc')).toBe('')
      expect(normalizeNumericInput('1.2.3')).toBe('')
      expect(normalizeNumericInput('NaN')).toBe('')
      expect(normalizeNumericInput('12px')).toBe('')
    })
  })

  describe('isFiniteNumericString', () => {
    it('returns false for blank or whitespace', () => {
      expect(isFiniteNumericString('')).toBe(false)
      expect(isFiniteNumericString('   ')).toBe(false)
    })

    it('returns true for finite numeric strings', () => {
      expect(isFiniteNumericString('0')).toBe(true)
      expect(isFiniteNumericString('42')).toBe(true)
      expect(isFiniteNumericString('-1.5')).toBe(true)
      expect(isFiniteNumericString(' 3.14 ')).toBe(true)
    })

    it('returns false for non-numeric strings', () => {
      expect(isFiniteNumericString('varchar12')).toBe(false)
      expect(isFiniteNumericString('A')).toBe(false)
      expect(isFiniteNumericString('NaN')).toBe(false)
    })
  })

  describe('getNumericFieldError', () => {
    it('returns "This field is required." when required and blank', () => {
      expect(getNumericFieldError('', true)).toBe('This field is required.')
      expect(getNumericFieldError('   ', true)).toBe('This field is required.')
    })

    it('returns null when required and valid number', () => {
      expect(getNumericFieldError('23', true)).toBe(null)
      expect(getNumericFieldError('0', true)).toBe(null)
    })

    it('returns null when optional and blank', () => {
      expect(getNumericFieldError('', false)).toBe(null)
      expect(getNumericFieldError('  ', false)).toBe(null)
    })

    it('returns "Enter a number." when non-empty and invalid', () => {
      expect(getNumericFieldError('varchar12', true)).toBe('Enter a number.')
      expect(getNumericFieldError('varchar12', false)).toBe('Enter a number.')
      expect(getNumericFieldError('A', false)).toBe('Enter a number.')
    })

    it('returns null when non-empty and valid number', () => {
      expect(getNumericFieldError('42', false)).toBe(null)
      expect(getNumericFieldError('-1.5', true)).toBe(null)
    })
  })
})

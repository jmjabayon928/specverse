// tests/utils/otherConversions.test.ts
import { extractPressureAnnotation } from '../../src/utils/otherConversions'

describe('extractPressureAnnotation', () => {
  it('extractPressureAnnotation(undefined) returns { annot: "", bare: "" }', () => {
    expect(extractPressureAnnotation(undefined)).toEqual({ annot: '', bare: '' })
  })

  it('extractPressureAnnotation(null) returns { annot: "", bare: "" }', () => {
    expect(extractPressureAnnotation(null)).toEqual({ annot: '', bare: '' })
  })

  it('extractPressureAnnotation(123) does not throw and returns bare "123"', () => {
    expect(extractPressureAnnotation(123)).toEqual({ annot: '', bare: '123' })
  })

  it('extractPressureAnnotation("kPa (g)") returns { annot: "(g)", bare: "kPa" }', () => {
    expect(extractPressureAnnotation('kPa (g)')).toEqual({ annot: '(g)', bare: 'kPa' })
  })

  it('extractPressureAnnotation("kPa(a)") returns { annot: "(a)", bare: "kPa" }', () => {
    expect(extractPressureAnnotation('kPa(a)')).toEqual({ annot: '(a)', bare: 'kPa' })
  })
})

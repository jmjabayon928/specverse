/** @jest-environment node */
import { parseLang } from '../../src/backend/utils/parseLang'

describe('parseLang', () => {
  it('normalizes "en" to "eng"', () => {
    expect(parseLang('en')).toBe('eng')
    expect(parseLang('EN')).toBe('eng')
  })

  it('returns "eng" when input is "eng"', () => {
    expect(parseLang('eng')).toBe('eng')
  })

  it('returns allowlisted languages as-is', () => {
    expect(parseLang('fr')).toBe('fr')
    expect(parseLang('de')).toBe('de')
    expect(parseLang('ru')).toBe('ru')
    expect(parseLang('zh')).toBe('zh')
    expect(parseLang('ar')).toBe('ar')
  })

  it('returns "eng" for unsupported or invalid input', () => {
    expect(parseLang('xx')).toBe('eng')
    expect(parseLang('jp')).toBe('eng')
    expect(parseLang('')).toBe('eng')
    expect(parseLang('   ')).toBe('eng')
    expect(parseLang(undefined)).toBe('eng')
    expect(parseLang(null)).toBe('eng')
  })

  it('accepts array and uses first element', () => {
    expect(parseLang(['eng'])).toBe('eng')
    expect(parseLang(['fr'])).toBe('fr')
    expect(parseLang(['en'])).toBe('eng')
    expect(parseLang(['xx'])).toBe('eng')
  })

  it('falls back to "eng" for empty array', () => {
    expect(parseLang([])).toBe('eng')
  })
})

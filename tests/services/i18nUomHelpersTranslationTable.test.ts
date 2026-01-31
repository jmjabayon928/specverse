/** @jest-environment node */
const queryCalls: string[] = []

jest.mock('../../src/backend/config/db', () => {
  const createRequest = () => ({
    query: (sql: string) => {
      queryCalls.push(sql)
      if (sql.includes('OBJECT_ID')) {
        return Promise.resolve({
          recordset: [{ exists: 1 }],
          recordsets: [[{ exists: 1 }]],
          rowsAffected: [0],
        })
      }
      if (sql.includes('SELECT InfoTemplateID')) {
        return Promise.resolve({
          recordset: [{ InfoTemplateID: 1, Label: 'Étiquette FR' }],
          recordsets: [[{ InfoTemplateID: 1, Label: 'Étiquette FR' }]],
          rowsAffected: [0],
        })
      }
      return Promise.resolve({
        recordset: [],
        recordsets: [[]],
        rowsAffected: [0],
      })
    },
    input: function (this: unknown) {
      return this
    },
    output: function (this: unknown) {
      return this
    },
  })
  return {
    poolPromise: Promise.resolve({
      request: createRequest,
    }),
    sql: {},
  }
})

import type { LangCode } from '../../src/backend/services/i18nUomHelpers'
import {
  primeTemplateLabelTranslations,
  getTranslatedFieldLabel,
} from '../../src/backend/services/i18nUomHelpers'

describe('i18nUomHelpers translation table', () => {
  beforeEach(() => {
    queryCalls.length = 0
  })

  it('uses InfoTemplateTranslations table, not InformationTemplateTranslations', async () => {
    await primeTemplateLabelTranslations([1, 2], 'fr' as LangCode)

    const existsQuery = queryCalls[0] ?? ''
    const selectQuery = queryCalls[1] ?? ''

    expect(existsQuery).toContain('InfoTemplateTranslations')
    expect(existsQuery).not.toContain('InformationTemplateTranslations')

    expect(selectQuery).toContain('InfoTemplateTranslations')
    expect(selectQuery).not.toContain('InformationTemplateTranslations')
  })

  it('getTranslatedFieldLabel returns fallback for en and eng (no DB)', () => {
    expect(getTranslatedFieldLabel(1, 'Fallback', 'en')).toBe('Fallback')
    expect(getTranslatedFieldLabel(1, 'Fallback', 'eng')).toBe('Fallback')
  })

  it('when priming returns a translated label for lang=fr, getTranslatedFieldLabel returns that label', async () => {
    await primeTemplateLabelTranslations([1], 'fr' as LangCode)
    expect(getTranslatedFieldLabel(1, 'Fallback', 'fr' as LangCode)).toBe('Étiquette FR')
  })
})

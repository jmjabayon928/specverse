// Regression: Add Field must add exactly one slot when onAddField is provided (no double-add).
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import InfoTemplateBuilder from '../../../src/app/(admin)/datasheets/templates/create/InfoTemplateBuilder'
import type { InfoField } from '../../../src/domain/datasheets/sheetTypes'

const subsheetWithTwoFields = {
  id: 10,
  name: 'Sub1',
  fields: [
    { label: 'A', infoType: 'varchar' as const, uom: '', sortOrder: 1, required: false, options: [] },
    { label: 'B', infoType: 'int' as const, uom: '', sortOrder: 2, required: false, options: [] },
  ] as InfoField[],
}

describe('InfoTemplateBuilder', () => {
  it('when onAddField is provided, Add Field calls onAddField once and does not update local fields (avoids double-add)', async () => {
    const user = userEvent.setup()
    const onFieldsChange = jest.fn()
    const onAddField = jest.fn()

    render(
      <InfoTemplateBuilder
        subsheet={subsheetWithTwoFields}
        subsheetIndex={0}
        onFieldsChange={onFieldsChange}
        isEditMode={true}
        onAddField={onAddField}
      />
    )

    const addButton = screen.getByRole('button', { name: /add field/i })
    await user.click(addButton)

    expect(onAddField).toHaveBeenCalledTimes(1)
    expect(onAddField).toHaveBeenCalledWith(
      expect.objectContaining({
        label: '',
        infoType: 'varchar',
        required: false,
        sortOrder: 3,
      })
    )
    // Must not have added the field locally when parent will add after API
    expect(onFieldsChange).not.toHaveBeenCalled()
  })

  it('when onAddField is not provided, Add Field updates fields via onFieldsChange', async () => {
    const user = userEvent.setup()
    const onFieldsChange = jest.fn()

    render(
      <InfoTemplateBuilder
        subsheet={subsheetWithTwoFields}
        subsheetIndex={0}
        onFieldsChange={onFieldsChange}
        isEditMode={true}
      />
    )

    const addButton = screen.getByRole('button', { name: /add field/i })
    await user.click(addButton)

    expect(onFieldsChange).toHaveBeenCalledTimes(1)
    const newFields = onFieldsChange.mock.calls[0][0] as InfoField[]
    expect(newFields).toHaveLength(3)
    expect(newFields[2]).toMatchObject({
      label: '',
      infoType: 'varchar',
      required: false,
      sortOrder: 3,
    })
  })
})

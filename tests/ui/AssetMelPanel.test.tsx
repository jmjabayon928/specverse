// tests/ui/AssetMelPanel.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AssetMelPanel from '../../src/components/assets/AssetMelPanel'
import type { AssetCustomFieldDto } from '../../src/types/api/assets'

describe('AssetMelPanel', () => {
  it('renders empty state when customFields is empty', () => {
    render(<AssetMelPanel customFields={[]} />)

    expect(screen.getByText('MEL Fields')).toBeInTheDocument()
    expect(screen.getByText('No custom fields available for this asset.')).toBeInTheDocument()
  })

  it('renders string value correctly', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'pump_name',
        displayLabel: 'Pump Name',
        dataType: 'string',
        value: 'Pump A',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText('Pump Name')).toBeInTheDocument()
    expect(screen.getByText('Pump A')).toBeInTheDocument()
  })

  it('renders boolean true as "Yes"', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 2,
        fieldKey: 'is_active',
        displayLabel: 'Is Active',
        dataType: 'boolean',
        value: true,
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText('Is Active')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })

  it('renders boolean false as "No"', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 3,
        fieldKey: 'is_active',
        displayLabel: 'Is Active',
        dataType: 'boolean',
        value: false,
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText('Is Active')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('renders ISO date string as formatted date', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 4,
        fieldKey: 'installed_date',
        displayLabel: 'Installed Date',
        dataType: 'date',
        value: '2026-03-05T12:34:56.000Z',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText('Installed Date')).toBeInTheDocument()
    const dateDisplay = screen.getByText(/2026/)
    expect(dateDisplay).toBeInTheDocument()
    expect(dateDisplay.textContent).not.toBe('—')
  })

  it('renders null value as "—"', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 5,
        fieldKey: 'notes',
        displayLabel: 'Notes',
        dataType: 'string',
        value: null,
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders multiple fields correctly', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'field1',
        displayLabel: 'Field One',
        dataType: 'string',
        value: 'Value One',
      },
      {
        customFieldId: 2,
        fieldKey: 'field2',
        displayLabel: 'Field Two',
        dataType: 'number',
        value: 42,
      },
      {
        customFieldId: 3,
        fieldKey: 'field3',
        displayLabel: 'Field Three',
        dataType: 'boolean',
        value: true,
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText('Field One')).toBeInTheDocument()
    expect(screen.getByText('Value One')).toBeInTheDocument()
    expect(screen.getByText('Field Two')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Field Three')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
  })
})

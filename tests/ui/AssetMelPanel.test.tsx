// tests/ui/AssetMelPanel.test.tsx
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import AssetMelPanel from '../../src/components/assets/AssetMelPanel'
import type { AssetCustomFieldDto } from '../../src/types/api/assets'

describe('AssetMelPanel', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })
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

  it('groups key MEL fields separately from other fields', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'manufacturer',
        displayLabel: 'Manufacturer',
        dataType: 'string',
        value: 'ACME Corp',
      },
      {
        customFieldId: 2,
        fieldKey: 'model_number',
        displayLabel: 'Model Number',
        dataType: 'string',
        value: 'M-123',
      },
      {
        customFieldId: 3,
        fieldKey: 'custom_field',
        displayLabel: 'Custom Field',
        dataType: 'string',
        value: 'Custom Value',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText(/Key MEL Fields/i)).toBeInTheDocument()
    expect(screen.getByText(/Other Fields/i)).toBeInTheDocument()
    expect(screen.getByText('Manufacturer')).toBeInTheDocument()
    expect(screen.getByText('Model Number')).toBeInTheDocument()
    expect(screen.getByText('Custom Field')).toBeInTheDocument()
  })

  it('sorts key MEL fields by priority order', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'voltage',
        displayLabel: 'Voltage',
        dataType: 'string',
        value: '240V',
      },
      {
        customFieldId: 2,
        fieldKey: 'manufacturer',
        displayLabel: 'Manufacturer',
        dataType: 'string',
        value: 'ACME Corp',
      },
      {
        customFieldId: 3,
        fieldKey: 'model',
        displayLabel: 'Model',
        dataType: 'string',
        value: 'M-123',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    const rows = screen.getAllByText(/Manufacturer|Model|Voltage/)
    // Manufacturer should appear before Model, Model before Voltage
    expect(rows[0].textContent).toBe('Manufacturer')
    expect(rows[1].textContent).toBe('Model')
    expect(rows[2].textContent).toBe('Voltage')
  })

  it('sorts other fields alphabetically by display label', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'zebra',
        displayLabel: 'Zebra Field',
        dataType: 'string',
        value: 'Z Value',
      },
      {
        customFieldId: 2,
        fieldKey: 'alpha',
        displayLabel: 'Alpha Field',
        dataType: 'string',
        value: 'A Value',
      },
      {
        customFieldId: 3,
        fieldKey: 'beta',
        displayLabel: 'Beta Field',
        dataType: 'string',
        value: 'B Value',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    const rows = screen.getAllByText(/Alpha Field|Beta Field|Zebra Field/)
    expect(rows[0].textContent).toBe('Alpha Field')
    expect(rows[1].textContent).toBe('Beta Field')
    expect(rows[2].textContent).toBe('Zebra Field')
  })

  it('matches key fields by fieldKey case-insensitively', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'MANUFACTURER',
        displayLabel: 'Manufacturer Name',
        dataType: 'string',
        value: 'ACME Corp',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText(/Key MEL Fields/i)).toBeInTheDocument()
    expect(screen.getByText('Manufacturer Name')).toBeInTheDocument()
  })

  it('matches key fields by displayLabel case-insensitively', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'custom_key',
        displayLabel: 'Model Number',
        dataType: 'string',
        value: 'M-123',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText(/Key MEL Fields/i)).toBeInTheDocument()
    expect(screen.getByText('Model Number')).toBeInTheDocument()
  })

  it('renders all fields even when only key fields exist', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'manufacturer',
        displayLabel: 'Manufacturer',
        dataType: 'string',
        value: 'ACME Corp',
      },
      {
        customFieldId: 2,
        fieldKey: 'model',
        displayLabel: 'Model',
        dataType: 'string',
        value: 'M-123',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.getByText(/Key MEL Fields/i)).toBeInTheDocument()
    expect(screen.queryByText(/Other Fields/i)).not.toBeInTheDocument()
    expect(screen.getByText('Manufacturer')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('renders all fields even when only other fields exist', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'custom1',
        displayLabel: 'Custom Field One',
        dataType: 'string',
        value: 'Value One',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(screen.queryByText(/Key MEL Fields/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Other Fields/i)).toBeInTheDocument()
    expect(screen.getByText('Custom Field One')).toBeInTheDocument()
  })

  it('keyFieldPriority override changes ordering', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'voltage',
        displayLabel: 'Voltage',
        dataType: 'string',
        value: '240V',
      },
      {
        customFieldId: 2,
        fieldKey: 'manufacturer',
        displayLabel: 'Manufacturer',
        dataType: 'string',
        value: 'ACME Corp',
      },
    ]

    // Swap priorities: voltage should appear before manufacturer
    const customPriority = {
      voltage: 1,
      manufacturer: 2,
    }

    render(<AssetMelPanel customFields={customFields} keyFieldPriority={customPriority} />)

    const rows = screen.getAllByText(/Manufacturer|Voltage/)
    expect(rows[0].textContent).toBe('Voltage')
    expect(rows[1].textContent).toBe('Manufacturer')
  })

  it('deterministic tie-break in Key MEL Fields', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 2,
        fieldKey: 'manufacturer_b',
        displayLabel: 'Manufacturer B',
        dataType: 'string',
        value: 'B Corp',
      },
      {
        customFieldId: 1,
        fieldKey: 'manufacturer_a',
        displayLabel: 'Manufacturer A',
        dataType: 'string',
        value: 'A Corp',
      },
    ]

    // Both match "manufacturer" key, same priority
    const customPriority = {
      manufacturer: 1,
    }

    render(<AssetMelPanel customFields={customFields} keyFieldPriority={customPriority} />)

    const rows = screen.getAllByText(/Manufacturer/)
    // Should be sorted by label (A before B), then by ID if labels same
    expect(rows[0].textContent).toBe('Manufacturer A')
    expect(rows[1].textContent).toBe('Manufacturer B')
  })

  it('deterministic tie-break in Other Fields', () => {
    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 2,
        fieldKey: 'field2',
        displayLabel: 'Same Label',
        dataType: 'string',
        value: 'Value 2',
      },
      {
        customFieldId: 1,
        fieldKey: 'field1',
        displayLabel: 'Same Label',
        dataType: 'string',
        value: 'Value 1',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    const rows = screen.getAllByText('Same Label')
    // Should be sorted by customFieldId (1 before 2)
    expect(rows[0].textContent).toBe('Same Label')
    expect(rows[1].textContent).toBe('Same Label')
    // Verify order by checking parent elements
    const parentElements = rows.map((r) => r.closest('div[class*="flex justify-between"]'))
    expect(parentElements[0]?.textContent).toContain('Value 1')
    expect(parentElements[1]?.textContent).toContain('Value 2')
  })

  it('collision warning fires in non-production', () => {
    process.env.NODE_ENV = 'test'
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'manufacturer_a',
        displayLabel: 'Manufacturer A',
        dataType: 'string',
        value: 'A Corp',
      },
      {
        customFieldId: 2,
        fieldKey: 'manufacturer_b',
        displayLabel: 'Manufacturer B',
        dataType: 'string',
        value: 'B Corp',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[AssetMelPanel] Duplicate key MEL match for "manufacturer"')
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('customFieldIds=1,2'))

    warnSpy.mockRestore()
  })

  it('collision warning does NOT fire in production', () => {
    process.env.NODE_ENV = 'production'
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const customFields: AssetCustomFieldDto[] = [
      {
        customFieldId: 1,
        fieldKey: 'manufacturer_a',
        displayLabel: 'Manufacturer A',
        dataType: 'string',
        value: 'A Corp',
      },
      {
        customFieldId: 2,
        fieldKey: 'manufacturer_b',
        displayLabel: 'Manufacturer B',
        dataType: 'string',
        value: 'B Corp',
      },
    ]

    render(<AssetMelPanel customFields={customFields} />)

    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })
})

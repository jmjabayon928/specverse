// src/utils/OtherConversionsCell.tsx
import React, { useMemo } from 'react'
import type { EngineeringSystem, OtherConversion } from '@/utils/otherConversions'
import { getOtherSameSystemConversions } from '@/utils/otherConversions'
import { normalizeUnit } from '@/utils/unitKinds'

type Props = Readonly<{
  numericValue: number | string              // raw value (string or numeric)
  unit: string                               // displayed engineering unit
  system: EngineeringSystem                  // SI | USC toggle
  emptyGlyph?: string                        // glyph when there are no alternates
}>

// Central place to control styling for conversion badges
const CONVERSION_BADGE_CLASS = 'inline-flex items-center rounded bg-muted px-2 py-0.5 text-xs'

// Hook for future truncation if the list grows too long.
// For now, this keeps behavior identical (no truncation).
const MAX_VISIBLE_CONVERSIONS = Number.POSITIVE_INFINITY

const PRETTY_UNIT_MAP: Record<string, string> = {
  l: 'L',
  ml: 'mL',
  m3: 'm³',
  m2: 'm²',
  'w/m.k': 'W/m·K',
  'kj/kg.k': 'kJ/kg·K',
  'btu/(hr.ft.f)': 'BTU/(hr·ft·°F)',
  'btu/(hr.ft2.f)': 'BTU/(hr·ft²·°F)',
  'ft2.f.hr/btu': 'ft²·°F·hr/BTU',
  'kg/m3': 'kg/m³',
  'lb/ft3': 'lb/ft³',
  'm3/h': 'm³/h',
  'm3/min': 'm³/min',
}

// Short unit pretty printer for UI display
const prettyUnit = (unit: string): string => {
  const normalized = normalizeUnit(unit)
  const pretty = PRETTY_UNIT_MAP[normalized]

  if (pretty) {
    return pretty
  }

  return unit
}

const formatNumber = (value: number): string => (
  Number.isFinite(value) ? value.toString() : ''
)

export default function OtherConversionsCell(props: Props) {
  const { numericValue, unit, system, emptyGlyph = '—' } = props

  const valueNum = useMemo(() => {
    if (typeof numericValue === 'string') {
      return Number.parseFloat(numericValue)
    }

    return numericValue
  }, [numericValue])

  const items: OtherConversion[] = useMemo(() => {
    if (!Number.isFinite(valueNum)) {
      return []
    }

    return getOtherSameSystemConversions(valueNum, unit, system)
  }, [valueNum, unit, system])

  if (items.length === 0) {
    return <span aria-label='no other conversions'>{emptyGlyph}</span>
  }

  // Ready for future truncation if needed; currently returns all items.
  const visibleItems = items.slice(0, MAX_VISIBLE_CONVERSIONS)

  return (
    <div className='flex flex-wrap gap-2' aria-label='other conversions'>
      {visibleItems.map(item => (
        <span
          key={`${item.unit}-${item.value}`}
          className={CONVERSION_BADGE_CLASS}
        >
          {formatNumber(Number.parseFloat(item.value))} {prettyUnit(item.unit)}
        </span>
      ))}
    </div>
  )
}

// src/components/datasheets/UnitToggle.tsx
'use client'

interface UnitToggleProps {
  unitSystem: 'SI' | 'USC'
  onToggle: (unit: 'SI' | 'USC') => void
}

function getNextUnit(current: 'SI' | 'USC'): 'SI' | 'USC' {
  if (current === 'SI') {
    return 'USC'
  }

  return 'SI'
}

function getButtonClasses(unitSystem: 'SI' | 'USC'): string {
  if (unitSystem === 'SI') {
    return 'bg-blue-600 text-white'
  }

  return 'bg-red-600 text-white'
}

export default function UnitToggle(props: Readonly<UnitToggleProps>) {
  const { unitSystem, onToggle } = props

  function handleClick() {
    const next = getNextUnit(unitSystem)
    onToggle(next)
  }

  const buttonClasses = getButtonClasses(unitSystem)

  return (
    <button
      type='button'
      onClick={handleClick}
      className={`border px-3 py-1 rounded text-sm ${buttonClasses}`}
      title='Toggle unit system'
    >
      {unitSystem}
    </button>
  )
}

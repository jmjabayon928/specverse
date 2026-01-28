// src/components/datasheets/SheetHeaderBar.tsx

interface SheetHeaderBarProps {
  selectedLang: string
  onLangChange: (lang: string) => void
  unitSystem: 'SI' | 'USC'
  onUnitToggle: () => void
}

function getUnitClasses(unitSystem: 'SI' | 'USC'): string {
  if (unitSystem === 'SI') {
    return 'bg-blue-600 text-white'
  }

  return 'bg-red-600 text-white'
}

export default function SheetHeaderBar(props: Readonly<SheetHeaderBarProps>) {
  const { selectedLang, onLangChange, unitSystem, onUnitToggle } = props

  const unitClasses = getUnitClasses(unitSystem)

  function handleLanguageChange(event: React.ChangeEvent<HTMLSelectElement>) {
    onLangChange(event.target.value)
  }

  return (
    <div className='flex items-center gap-2'>
      <button
        type='button'
        onClick={onUnitToggle}
        className={`px-3 py-1 rounded text-sm ${unitClasses}`}
        title='Toggle unit system'
      >
        {unitSystem}
      </button>

      <label className='text-sm text-gray-700'>
        <span className='sr-only'>Select language</span>
        <select
          value={selectedLang}
          title='Select language'
          onChange={handleLanguageChange}
          className='bg-green-600 text-white px-2 py-1 rounded text-sm'
        >
          <option value='eng'>English</option>
          <option value='fr'>French</option>
          <option value='de'>German</option>
          <option value='ru'>Russian</option>
          <option value='zh'>Chinese</option>
          <option value='ar'>Arabic</option>
        </select>
      </label>
    </div>
  )
}

// src/components/ui/avatar/AvatarText.tsx

interface AvatarTextProps {
  name: string
  className?: string
}

const colorClasses = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
  'bg-emerald-100 text-emerald-700',
]

const getInitials = (name: string): string => {
  if (!name.trim()) {
    return '?'
  }

  const parts = name.trim().split(/\s+/)
  const letters = parts.map((part) => part[0] ?? '').join('')

  return letters.toUpperCase().slice(0, 2)
}

const getColorClass = (name: string): string => {
  if (!name.trim()) {
    return colorClasses[0]
  }

  let total = 0

  for (const char of name) {
    const codePoint = char.codePointAt(0)
    if (typeof codePoint === 'number') {
      total += codePoint
    }
  }

  const index = Math.trunc(Math.abs(total)) % colorClasses.length
  return colorClasses[index]
}

const AvatarText = (props: Readonly<AvatarTextProps>) => {
  const { name, className = '' } = props

  const initials = getInitials(name)
  const colorClass = getColorClass(name)

  return (
    <div
      className={`flex h-10 w-10 items-center justify-center rounded-full ${colorClass} ${className}`}
      aria-label={name}
      title={name}
    >
      <span className='text-sm font-medium'>
        {initials}
      </span>
    </div>
  )
}

export default AvatarText

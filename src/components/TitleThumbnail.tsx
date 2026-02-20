interface TitleThumbnailProps {
  title: string
  /** Optional seed for consistent gradient (e.g. course id or lesson id) */
  seed?: string
  className?: string
  /** Compact mode for small thumbnails (e.g. lesson list) */
  compact?: boolean
  /** Card style: light background, bold uppercase title, optional subtitle (like Skool/IRON Media) */
  variant?: 'gradient' | 'card'
  /** Subtitle shown below main title in card variant (e.g. "Salino GmbH - SOP Library") */
  subtitle?: string
}

// Deterministic gradient index from a string seed
function gradientIndex(seed: string): number {
  let n = 0
  for (let i = 0; i < seed.length; i++) n = (n * 31 + seed.charCodeAt(i)) >>> 0
  return n % 6
}

const GRADIENTS = [
  'from-indigo-500 to-indigo-700',
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-teal-500 to-emerald-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
]

export function TitleThumbnail({
  title,
  seed,
  className = '',
  compact = false,
  variant = 'gradient',
  subtitle,
}: TitleThumbnailProps) {
  const safeTitle = title?.trim() || 'Lesson'
  const gradient = GRADIENTS[gradientIndex(seed ?? safeTitle)]
  const displayText = compact
    ? safeTitle.slice(0, 2).toUpperCase()
    : safeTitle.length > 60
      ? safeTitle.slice(0, 57) + '...'
      : safeTitle

  if (variant === 'card') {
    return (
      <div
        className={`bg-gray-50 flex flex-col items-center justify-center overflow-hidden border-b border-gray-200 ${className}`}
        title={safeTitle}
      >
        <p className="text-gray-900 font-bold text-center px-4 py-4 sm:py-6 text-sm sm:text-base lg:text-lg uppercase tracking-tight leading-tight line-clamp-2">
          {displayText}
        </p>
        {subtitle && (
          <p className="text-gray-500 text-xs text-center px-4 pb-4">
            {subtitle}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className={`bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden ${className}`}
      title={safeTitle}
    >
      {compact ? (
        <span className="text-white font-bold text-sm drop-shadow-sm">
          {displayText}
        </span>
      ) : (
        <p className="text-white font-semibold text-center px-3 py-2 line-clamp-3 drop-shadow-sm text-sm leading-snug">
          {displayText}
        </p>
      )}
    </div>
  )
}

import React from 'react'
import { cn } from '../../lib/cn'

const TONE_CLASSES = {
  wellness: { bg: 'bg-wellness-500', fg: 'text-wellness-700', pill: 'bg-wellness-100 text-wellness-800 border-wellness-200' },
  amber:    { bg: 'bg-amber-500',    fg: 'text-amber-700',    pill: 'bg-amber-100 text-amber-800 border-amber-200' },
  rose:     { bg: 'bg-rose-500',     fg: 'text-rose-700',     pill: 'bg-rose-100 text-rose-800 border-rose-200' },
  brand:    { bg: 'bg-brand-500',    fg: 'text-brand-700',    pill: 'bg-brand-100 text-brand-800 border-brand-200' },
}

/**
 * Barra visual del score con etiqueta de severidad.
 * Props:
 *  - score, maxScore
 *  - severityLabel, severityTone ('wellness'|'amber'|'rose'|'brand')
 */
export default function SeverityBar({ score, maxScore, severityLabel, severityTone = 'wellness', size = 'md' }) {
  const tone = TONE_CLASSES[severityTone] || TONE_CLASSES.wellness
  const pct = maxScore ? Math.min(100, Math.max(0, (score / maxScore) * 100)) : 0
  const isSmall = size === 'sm'

  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <div className={cn(
          'flex items-baseline gap-1.5 font-bold tabular-nums',
          isSmall ? 'text-base' : 'text-2xl',
          tone.fg,
        )}>
          <span>{score}</span>
          <span className={cn('font-normal text-ink-400', isSmall ? 'text-xs' : 'text-sm')}>/ {maxScore}</span>
        </div>
        <span className={cn(
          'inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border',
          tone.pill,
        )}>
          {severityLabel}
        </span>
      </div>
      <div className={cn('w-full bg-ink-100 rounded-full overflow-hidden', isSmall ? 'h-1.5' : 'h-2.5')}>
        <div className={cn('h-full transition-all duration-500', tone.bg)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

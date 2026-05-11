import React from 'react'
import { cn } from '../../lib/cn'

const tones = {
  brand:    'bg-brand-50 text-brand-700 border-brand-100',
  ink:      'bg-ink-100 text-ink-700 border-ink-200',
  success:  'bg-wellness-50 text-wellness-700 border-wellness-100',
  warning:  'bg-amber-50 text-amber-700 border-amber-100',
  danger:   'bg-red-50 text-red-700 border-red-100',
  outline:  'bg-white text-ink-700 border-ink-200',
}

export function Badge({ tone = 'ink', dot = false, className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

const statusConfig = {
  scheduled: { tone: 'brand',   label: 'Agendada' },
  confirmed: { tone: 'success', label: 'Confirmada' },
  cancelled: { tone: 'danger',  label: 'Cancelada' },
  completed: { tone: 'ink',     label: 'Completada' },
  no_show:   { tone: 'warning', label: 'No asistió' },
}

export function StatusBadge({ status, className }) {
  const cfg = statusConfig[status] || { tone: 'ink', label: status }
  return <Badge tone={cfg.tone} dot className={className}>{cfg.label}</Badge>
}

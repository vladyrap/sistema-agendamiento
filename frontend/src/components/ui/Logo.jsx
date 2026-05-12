import React from 'react'
import { cn } from '../../lib/cn'

// Logo simbólico: sol naciente sobre el horizonte (renovación, calma, nuevo día).
export function LogoMark({ className, size = 36 }) {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-2xl shadow-brand-sm',
        'bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800',
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3/5 h-3/5"
      >
        <path d="M12 2v2" />
        <path d="m4.93 7.93 1.41 1.41" />
        <path d="m17.66 9.34 1.41-1.41" />
        <path d="M2 18h2" />
        <path d="M20 18h2" />
        <path d="M6 18a6 6 0 0 1 12 0" />
        <path d="M3 21h18" />
      </svg>
    </div>
  )
}

export function Logo({ className, withWordmark = true }) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={32} />
      {withWordmark && (
        <span className="text-[15px] font-bold tracking-tight text-ink-900">
          Calmar<span className="text-brand-600">.</span>
        </span>
      )}
    </div>
  )
}

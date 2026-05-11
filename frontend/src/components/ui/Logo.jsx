import React from 'react'
import { cn } from '../../lib/cn'

// Logo simbólico: cruz médica + onda de cuidado, dentro de un cuadrado con gradiente.
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
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3/5 h-3/5"
      >
        <path d="M3.5 12c2.5 0 2.5-3.5 5-3.5S11 14 13.5 14s2.5-5 5-5 2 3 2 3" />
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

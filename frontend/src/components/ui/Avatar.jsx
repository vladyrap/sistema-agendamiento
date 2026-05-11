import React from 'react'
import { cn } from '../../lib/cn'

const sizes = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
  '2xl': 'w-28 h-28 text-3xl',
}

const palettes = [
  'from-brand-400 to-brand-600',
  'from-wellness-400 to-wellness-600',
  'from-amber-400 to-amber-600',
  'from-pink-400 to-pink-600',
  'from-sky-400 to-sky-600',
  'from-violet-400 to-violet-600',
]

function pickPalette(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return palettes[Math.abs(hash) % palettes.length]
}

export function Avatar({ name = '', src, size = 'md', className }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
  const palette = pickPalette(name)

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0',
        'bg-gradient-to-br ring-2 ring-white shadow-sm',
        palette,
        sizes[size],
        className,
      )}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <span className="select-none tracking-tight">{initials || '·'}</span>
      )}
    </div>
  )
}

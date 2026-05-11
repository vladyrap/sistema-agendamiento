import React, { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '../../lib/cn'

const sizes = { xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-6 h-6', xl: 'w-8 h-8' }

/** Lectura: muestra rating (decimal). 5 estrellas redondeadas a la mitad. */
export function Stars({ value = 0, size = 'sm', className }) {
  return (
    <div className={cn('inline-flex gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            sizes[size],
            i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-ink-200',
          )}
        />
      ))}
    </div>
  )
}

/** Input: para que el usuario califique. */
export function StarInput({ value = 0, onChange, size = 'lg', className }) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  return (
    <div className={cn('inline-flex gap-1', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.(i)}
          className="transition-transform hover:scale-110 active:scale-95"
          aria-label={`${i} de 5 estrellas`}
        >
          <Star
            className={cn(
              sizes[size],
              'transition-colors',
              i <= display ? 'fill-amber-400 text-amber-400' : 'text-ink-200',
            )}
          />
        </button>
      ))}
    </div>
  )
}

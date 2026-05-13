import React from 'react'
import { cn } from '../../lib/cn'

/**
 * Heading con efecto chromatic aberration (RGB split sutil).
 * El texto principal queda en blanco, y dos copias decaladas en cyan / magenta
 * crean una pista de profundidad sin perder legibilidad.
 *
 * Pasale el texto como children — se renderiza 3 veces (DOM) con `aria-hidden`
 * en las copias para no romper accesibilidad.
 */
export default function ChromaticHeading({
  as: Tag = 'h1',
  children,
  intensity = 'normal', // 'subtle' | 'normal' | 'strong'
  className = '',
}) {
  const offset = intensity === 'subtle' ? 1.5 : intensity === 'strong' ? 4 : 2.5

  return (
    <Tag className={cn('relative inline-block', className)}>
      <span
        aria-hidden
        className="absolute inset-0 text-cyan-400 mix-blend-screen opacity-70 animate-glitch"
        style={{ transform: `translate(-${offset}px, ${offset * 0.3}px)` }}
      >
        {children}
      </span>
      <span
        aria-hidden
        className="absolute inset-0 text-fuchsia-500 mix-blend-screen opacity-60 animate-glitch"
        style={{
          transform: `translate(${offset}px, -${offset * 0.3}px)`,
          animationDelay: '0.4s',
        }}
      >
        {children}
      </span>
      <span className="relative">{children}</span>
    </Tag>
  )
}

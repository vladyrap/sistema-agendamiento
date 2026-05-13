import React from 'react'
import { cn } from '../../lib/cn'

/**
 * Card con borde gradient cónico que rota lento.
 *
 * Truco: un pseudo-elemento (mask de gradient cónico) crea el borde brillante,
 * mientras que el contenido vive en una capa interior con fondo oscuro.
 * Funciona sin SVG ni canvas — solo CSS.
 */
export default function GradientBorderCard({
  children,
  className = '',
  innerClassName = '',
  glow = true,
  speed = 'normal', // 'slow' | 'normal' | 'fast'
}) {
  const animClass =
    speed === 'slow'
      ? 'animate-[borderSpin_12s_linear_infinite]'
      : speed === 'fast'
        ? 'animate-[borderSpin_4s_linear_infinite]'
        : 'animate-border-spin'

  return (
    <div className={cn('relative rounded-3xl p-[1px] overflow-hidden group', className)}>
      {/* Anillo gradient rotando */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-[-200%] z-0',
          animClass,
        )}
        style={{
          background:
            'conic-gradient(from 0deg at 50% 50%, rgba(99,102,241,0.0) 0deg, rgba(99,102,241,0.9) 50deg, rgba(236,72,153,0.7) 130deg, rgba(34,211,238,0.8) 210deg, rgba(99,102,241,0.0) 290deg)',
        }}
      />

      {/* Glow opcional al hover */}
      {glow && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-3xl bg-gradient-to-br from-brand-500/20 via-fuchsia-500/10 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl"
        />
      )}

      {/* Contenido */}
      <div
        className={cn(
          'relative z-10 rounded-[calc(1.5rem-1px)] bg-ink-950/85 backdrop-blur-xl',
          'ring-1 ring-white/5',
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}

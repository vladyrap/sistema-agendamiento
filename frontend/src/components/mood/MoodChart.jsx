import React, { useMemo } from 'react'
import { format, parseISO, differenceInCalendarDays, addDays, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '../../lib/cn'

/**
 * Gráfico SVG simple del estado de ánimo en el tiempo.
 *
 * - `entries`: array de { date: 'YYYY-MM-DD', score: 1..10, note? }
 * - Eje X: días; eje Y: 1..10
 * - Línea, puntos coloreados según el score, gradiente debajo de la línea
 */
export default function MoodChart({ entries = [], height = 180, className = '' }) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  )

  if (sorted.length === 0) {
    return (
      <div
        className={cn('flex items-center justify-center text-sm text-ink-500', className)}
        style={{ height }}
      >
        Aún no hay registros para mostrar.
      </div>
    )
  }

  // Bounds temporales: 30 días por defecto, expandible si hay datos viejos
  const firstDate = startOfDay(parseISO(sorted[0].date))
  const lastDate  = startOfDay(parseISO(sorted[sorted.length - 1].date))
  const today     = startOfDay(new Date())
  const minDate   = firstDate
  const maxDate   = today > lastDate ? today : lastDate
  const totalDays = Math.max(1, differenceInCalendarDays(maxDate, minDate))

  const W = 800
  const H = height
  const padX = 28
  const padY = 18
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  const x = (d) => {
    const days = differenceInCalendarDays(parseISO(d), minDate)
    return padX + (days / totalDays) * innerW
  }
  const y = (score) => padY + innerH - ((score - 1) / 9) * innerH

  const points = sorted.map((e) => ({
    x: x(e.date),
    y: y(e.score),
    score: e.score,
    date: e.date,
    note: e.note,
  }))

  // Path de la línea
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  // Path del área debajo (para gradient)
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`

  // Ticks Y
  const yTicks = [1, 5, 10]

  // Color del punto según score
  const colorFor = (s) => {
    if (s <= 3) return '#f43f5e' // rose-500
    if (s <= 5) return '#f59e0b' // amber-500
    if (s <= 7) return '#10b981' // wellness-500
    return '#4f46e5' // brand-600
  }

  return (
    <div className={cn('relative w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="moodArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid horizontal */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={padX}
              x2={W - padX}
              y1={y(t)}
              y2={y(t)}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray={t === 5 ? '0' : '3 4'}
            />
            <text x={6} y={y(t) + 4} fontSize="11" fill="#94a3b8">{t}</text>
          </g>
        ))}

        {/* Área */}
        {points.length > 1 && (
          <path d={areaPath} fill="url(#moodArea)" />
        )}

        {/* Línea */}
        {points.length > 1 && (
          <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Puntos */}
        {points.map((p) => (
          <g key={p.date}>
            <title>{format(parseISO(p.date), "EEEE d MMM", { locale: es })}: {p.score}/10{p.note ? ` — ${p.note}` : ''}</title>
            <circle cx={p.x} cy={p.y} r="5" fill={colorFor(p.score)} stroke="white" strokeWidth="2" />
          </g>
        ))}

        {/* Eje X: primer y último día */}
        <text x={points[0].x} y={H - 4} fontSize="10" fill="#94a3b8" textAnchor="start">
          {format(parseISO(sorted[0].date), 'd MMM', { locale: es })}
        </text>
        <text x={W - padX} y={H - 4} fontSize="10" fill="#94a3b8" textAnchor="end">
          {format(parseISO(sorted[sorted.length - 1].date), 'd MMM', { locale: es })}
        </text>
      </svg>
    </div>
  )
}

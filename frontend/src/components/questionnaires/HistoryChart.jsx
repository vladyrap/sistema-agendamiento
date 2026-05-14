import React, { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '../../lib/cn'

const TONE_COLORS = {
  wellness: '#10b981',
  amber:    '#f59e0b',
  rose:     '#f43f5e',
  brand:    '#4f46e5',
}

/**
 * Gráfico SVG simple del histórico de scores de un cuestionario.
 *
 * Props:
 *  - points: array de { completed_at, score, max_score, severity_tone }
 *  - maxScore: máximo posible del cuestionario (para escala Y)
 *  - height
 */
export default function HistoryChart({ points = [], maxScore = 27, height = 160, className = '' }) {
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.completed_at.localeCompare(b.completed_at)),
    [points],
  )

  if (sorted.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-sm text-ink-400', className)} style={{ height }}>
        Sin historial todavía.
      </div>
    )
  }

  const W = 800
  const H = height
  const padX = 30
  const padY = 18
  const innerW = W - padX * 2
  const innerH = H - padY * 2

  // Eje X: posiciones uniformes por índice
  const xFor = (i) => padX + (sorted.length === 1 ? innerW / 2 : (i / (sorted.length - 1)) * innerW)
  const yFor = (score) => padY + innerH - (score / maxScore) * innerH

  const ptList = sorted.map((p, i) => ({
    x: xFor(i),
    y: yFor(p.score),
    score: p.score,
    date: p.completed_at,
    tone: p.severity_tone || 'brand',
  }))

  const linePath = ptList
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const yTicks = [0, Math.round(maxScore / 2), maxScore]

  return (
    <div className={cn('relative w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="qhArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padX} x2={W - padX} y1={yFor(t)} y2={yFor(t)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={t === Math.round(maxScore/2) ? '0' : '3 4'} />
            <text x={6} y={yFor(t) + 4} fontSize="11" fill="#94a3b8">{t}</text>
          </g>
        ))}

        {/* Área bajo línea */}
        {ptList.length > 1 && (
          <path
            d={`${linePath} L ${ptList[ptList.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${ptList[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`}
            fill="url(#qhArea)"
          />
        )}

        {/* Línea */}
        {ptList.length > 1 && (
          <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Puntos */}
        {ptList.map((p, i) => (
          <g key={i}>
            <title>
              {format(parseISO(p.date), "d MMM yyyy 'a las' HH:mm", { locale: es })}: {p.score}/{maxScore}
            </title>
            <circle cx={p.x} cy={p.y} r="5" fill={TONE_COLORS[p.tone] || TONE_COLORS.brand} stroke="white" strokeWidth="2" />
          </g>
        ))}

        {/* Fechas eje X */}
        <text x={ptList[0].x} y={H - 4} fontSize="10" fill="#94a3b8" textAnchor="start">
          {format(parseISO(sorted[0].completed_at), 'd MMM', { locale: es })}
        </text>
        {sorted.length > 1 && (
          <text x={W - padX} y={H - 4} fontSize="10" fill="#94a3b8" textAnchor="end">
            {format(parseISO(sorted[sorted.length - 1].completed_at), 'd MMM', { locale: es })}
          </text>
        )}
      </svg>
    </div>
  )
}

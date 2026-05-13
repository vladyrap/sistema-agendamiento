import React, { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Heart, Flame, Activity, TrendingUp } from 'lucide-react'
import { moodApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import MoodChart from './MoodChart'

const EMOJI = {
  1: '😢', 2: '😞', 3: '😕', 4: '😐', 5: '🙂',
  6: '🙂', 7: '😊', 8: '😄', 9: '🤩', 10: '🌟',
}

const SCALE_LABELS = {
  1: 'muy mal', 2: 'mal', 3: 'bajo', 4: 'apagado', 5: 'neutro',
  6: 'bien', 7: 'muy bien', 8: 'genial', 9: 'pleno', 10: 'excelente',
}

/**
 * Card de resumen del diario emocional del paciente, para que el profesional
 * lo vea en la ficha. Lectura solamente.
 */
export default function PatientMoodCard({ patientId, days = 30, className = '' }) {
  const [summary, setSummary] = useState(null)
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      moodApi.patientSummary(patientId),
      moodApi.patientEntries(patientId, days),
    ])
      .then(([s, e]) => {
        if (cancelled) return
        setSummary(s.data)
        setEntries(e.data)
      })
      .catch(() => !cancelled && setError('No se pudo cargar el diario'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [patientId, days])

  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold inline-flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500" /> Diario emocional
        </h3>
        {summary && summary.days_logged > 0 && (
          <span className="text-[11px] uppercase tracking-wider text-ink-500 font-semibold">
            Últimos {days} días
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-8 flex justify-center"><Spinner /></div>
      ) : error ? (
        <p className="text-sm text-ink-500">{error}</p>
      ) : !summary || summary.days_logged === 0 ? (
        <div className="text-center py-6">
          <Heart className="w-8 h-8 text-ink-300 mx-auto" />
          <p className="text-sm text-ink-500 mt-2">El paciente aún no ha registrado su estado de ánimo.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Latest entry destacada */}
          {summary.latest && (
            <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-wellness-50 border border-brand-100 p-4">
              <div className="flex items-start gap-3">
                <div className="text-3xl leading-none mt-0.5">{EMOJI[summary.latest.score]}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-brand-700 font-semibold">
                    Último registro · {format(parseISO(summary.latest.date), "d 'de' MMM", { locale: es })}
                  </div>
                  <div className="text-sm text-ink-800 mt-1">
                    Se sintió <strong>{SCALE_LABELS[summary.latest.score]}</strong> ({summary.latest.score}/10)
                  </div>
                  {summary.latest.note && (
                    <p className="text-sm text-ink-700 mt-2 leading-relaxed italic">"{summary.latest.note}"</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stats compactas */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Registros', value: summary.days_logged, icon: Heart },
              { label: 'Racha', value: `${summary.current_streak}d`, icon: Flame },
              { label: 'Prom. 7d', value: summary.average_7d?.toFixed(1) ?? '—', icon: Activity },
              { label: 'Prom. 30d', value: summary.average_30d?.toFixed(1) ?? '—', icon: TrendingUp },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-ink-50/70 border border-ink-100 p-2.5 text-center">
                <div className="text-base font-bold tabular-nums text-ink-900">{s.value}</div>
                <div className="text-[10px] text-ink-500 mt-0.5 leading-none">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Mini chart */}
          {entries.length > 1 && (
            <div className="-mx-2">
              <MoodChart entries={entries} height={140} />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

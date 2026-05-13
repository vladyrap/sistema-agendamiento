import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Heart, Calendar, Flame, TrendingUp, Activity, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { moodApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import MoodCheckin from '../../components/mood/MoodCheckin'
import MoodChart from '../../components/mood/MoodChart'
import { fadeInUp } from '../../lib/motion'

const SCALE_LABELS = {
  1: 'Muy mal', 2: 'Mal', 3: 'Bajo', 4: 'Apagado', 5: 'Neutro',
  6: 'Bien', 7: 'Muy bien', 8: 'Genial', 9: 'Pleno', 10: 'Excelente',
}

const EMOJI = {
  1: '😢', 2: '😞', 3: '😕', 4: '😐', 5: '🙂',
  6: '🙂', 7: '😊', 8: '😄', 9: '🤩', 10: '🌟',
}

function scoreToColor(s) {
  if (s <= 3) return 'bg-rose-50 text-rose-700 border-rose-100'
  if (s <= 5) return 'bg-amber-50 text-amber-700 border-amber-100'
  if (s <= 7) return 'bg-wellness-50 text-wellness-700 border-wellness-100'
  return 'bg-brand-50 text-brand-700 border-brand-100'
}

export default function MoodHistory() {
  const [entries, setEntries] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState(30)

  async function load() {
    setLoading(true)
    try {
      const [e, s] = await Promise.all([
        moodApi.myEntries(range),
        moodApi.mySummary(),
      ])
      setEntries(e.data)
      setSummary(s.data)
    } catch {
      toast.error('No pudimos cargar tu historial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [range])

  const reversed = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  )

  async function deleteEntry(id) {
    if (!confirm('¿Borrar esta entrada? No podrás recuperarla.')) return
    try {
      await moodApi.delete(id)
      toast.success('Borrada')
      load()
    } catch {
      toast.error('No se pudo borrar')
    }
  }

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest">Diario emocional</h1>
        </div>
        <p className="text-ink-500 text-sm">
          Lleva registro de cómo te sientes. Solo tú lo ves — tu profesional podrá consultarlo si lo conversan en sesión.
        </p>
      </motion.div>

      {/* Check-in del día */}
      <MoodCheckin onSaved={() => load()} />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Registros', value: summary?.days_logged ?? 0, icon: Calendar, hue: 'brand' },
          { label: 'Racha actual', value: `${summary?.current_streak ?? 0}d`, icon: Flame, hue: 'amber' },
          { label: 'Promedio 7d', value: summary?.average_7d?.toFixed(1) ?? '—', icon: Activity, hue: 'wellness' },
          { label: 'Promedio 30d', value: summary?.average_30d?.toFixed(1) ?? '—', icon: TrendingUp, hue: 'rose' },
        ].map((s) => (
          <Card key={s.label} className="p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              s.hue === 'brand' ? 'bg-brand-50 text-brand-600' :
              s.hue === 'amber' ? 'bg-amber-50 text-amber-600' :
              s.hue === 'wellness' ? 'bg-wellness-50 text-wellness-600' :
              'bg-rose-50 text-rose-600'
            }`}>
              <s.icon className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold tracking-tight tabular-nums">{s.value}</div>
              <div className="text-xs text-ink-500 mt-0.5">{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Gráfico */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Evolución</h2>
            <p className="text-xs text-ink-500 mt-0.5">Últimos {range} días</p>
          </div>
          <div className="inline-flex rounded-lg bg-ink-100 p-0.5">
            {[7, 30, 90].map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  range === r ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                {r === 7 ? '7d' : r === 30 ? '30d' : '90d'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner /></div>
        ) : (
          <MoodChart entries={entries} height={220} />
        )}
      </Card>

      {/* Lista de entradas */}
      <Card>
        <div className="px-6 py-5 border-b border-ink-100">
          <h2 className="text-lg font-semibold">Tus registros</h2>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center"><Spinner /></div>
        ) : reversed.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Todavía no tienes registros"
            description="Empieza hoy. Solo te toma 5 segundos."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {reversed.map((e) => (
              <li key={e.id} className="px-6 py-4 flex items-start gap-4 group hover:bg-ink-50/60 transition-colors">
                <div className="text-3xl leading-none mt-1">{EMOJI[e.score]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-900">
                      {format(parseISO(e.date), "EEEE d 'de' MMMM", { locale: es })}
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${scoreToColor(e.score)}`}>
                      {e.score}/10 · {SCALE_LABELS[e.score]}
                    </span>
                  </div>
                  {e.note && (
                    <p className="text-sm text-ink-600 mt-1.5 leading-relaxed">"{e.note}"</p>
                  )}
                </div>
                <button
                  onClick={() => deleteEntry(e.id)}
                  className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-rose-600 transition-all p-1"
                  title="Borrar entrada"
                  aria-label="Borrar entrada"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

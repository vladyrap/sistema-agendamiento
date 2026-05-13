import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, ChevronRight, Sparkles, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { moodApi } from '../../services/api'
import { cn } from '../../lib/cn'

const SCALE = [
  { v: 1,  emoji: '😢', label: 'Muy mal' },
  { v: 2,  emoji: '😞', label: 'Mal' },
  { v: 3,  emoji: '😕', label: 'Bajo' },
  { v: 4,  emoji: '😐', label: 'Apagado' },
  { v: 5,  emoji: '🙂', label: 'Neutro' },
  { v: 6,  emoji: '🙂', label: 'Bien' },
  { v: 7,  emoji: '😊', label: 'Muy bien' },
  { v: 8,  emoji: '😄', label: 'Genial' },
  { v: 9,  emoji: '🤩', label: 'Pleno' },
  { v: 10, emoji: '🌟', label: 'Excelente' },
]

function moodColor(score) {
  if (score == null) return 'from-ink-200 to-ink-100'
  if (score <= 3) return 'from-rose-500 to-rose-300'
  if (score <= 5) return 'from-amber-500 to-amber-300'
  if (score <= 7) return 'from-wellness-500 to-wellness-300'
  return 'from-brand-600 to-brand-300'
}

/**
 * Widget de check-in diario para el dashboard del paciente.
 * - Si no registró hoy: muestra el selector 1-10 + nota opcional
 * - Si ya registró: muestra el estado registrado con opción de editar
 */
export default function MoodCheckin({ onSaved }) {
  const [today, setToday] = useState(null) // entrada de hoy si existe
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState(null)
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    moodApi.myToday()
      .then((r) => {
        if (r.data) {
          setToday(r.data)
          setScore(r.data.score)
          setNote(r.data.note || '')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!score) {
      toast.error('Elige una opción')
      return
    }
    setSaving(true)
    try {
      const { data } = await moodApi.checkIn({ score, note })
      setToday(data)
      setEditing(false)
      toast.success(today ? 'Actualizado' : '¡Anotado!')
      onSaved?.(data)
    } catch {
      toast.error('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const showForm = !today || editing
  const current = today ? SCALE.find((s) => s.v === today.score) : null

  return (
    <div className={cn(
      'relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white',
      'bg-gradient-to-br',
      moodColor(today?.score),
    )}>
      <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/15 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 font-semibold">
            <Sparkles className="w-3.5 h-3.5" /> Diario emocional
          </div>
          <Link
            to="/patient/mood"
            className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1"
          >
            Ver historial <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="h-24 flex items-center justify-center text-white/70 text-sm">Cargando…</div>
        ) : showForm ? (
          <div className="mt-4">
            <p className="text-lg font-semibold">¿Cómo te sientes hoy?</p>
            <p className="text-sm text-white/80 mt-0.5">
              Es solo para ti — tu profesional puede verlo si lo autorizas en consulta.
            </p>

            <div className="mt-5 grid grid-cols-10 gap-1.5">
              {SCALE.map((s) => (
                <motion.button
                  key={s.v}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setScore(s.v)}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-xl py-2.5 text-base',
                    'bg-white/10 border border-white/15 transition-colors',
                    score === s.v
                      ? 'bg-white text-ink-900 border-white shadow-lg'
                      : 'hover:bg-white/20',
                  )}
                  title={`${s.v} · ${s.label}`}
                  aria-label={`${s.v} · ${s.label}`}
                >
                  <span className="text-lg leading-none">{s.emoji}</span>
                  <span className={cn(
                    'text-[10px] mt-1 font-semibold',
                    score === s.v ? 'text-ink-700' : 'text-white/80'
                  )}>{s.v}</span>
                </motion.button>
              ))}
            </div>

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Una nota corta sobre tu día (opcional)…"
              rows={2}
              maxLength={1000}
              className={cn(
                'mt-4 w-full rounded-xl bg-white/10 border border-white/15 px-3.5 py-2.5',
                'text-sm text-white placeholder:text-white/50 resize-none',
                'focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15',
              )}
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-xs text-white/60">
                {score ? `${score}/10 · ${SCALE.find((s) => s.v === score).label}` : 'Elige una opción'}
              </div>
              <div className="flex items-center gap-2">
                {editing && (
                  <button
                    onClick={() => { setEditing(false); setScore(today.score); setNote(today.note || '') }}
                    className="text-xs text-white/80 hover:text-white px-3 py-1.5"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={save}
                  disabled={!score || saving}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold',
                    'bg-white text-ink-900 hover:bg-white/90 shadow-sm transition-all',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <Check className="w-4 h-4" />
                  {saving ? 'Guardando…' : today ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="saved"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-start gap-4"
            >
              <div className="text-5xl leading-none mt-1" aria-hidden>{current?.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold">
                  Hoy te sientes <span className="font-bold">{current?.label.toLowerCase()}</span>
                </div>
                <div className="text-sm text-white/80 mt-0.5 tabular-nums">{today.score}/10</div>
                {today.note && (
                  <p className="text-sm text-white/90 mt-2 leading-relaxed">"{today.note}"</p>
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

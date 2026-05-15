import React, { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, RefreshCw, AlertTriangle, ChevronDown, ChevronUp, Brain,
  TrendingDown, TrendingUp, Activity, ClipboardList,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { appointmentsApi } from '../../services/api'
import { Spinner } from '../ui/Spinner'
import { cn } from '../../lib/cn'

/**
 * Panel de briefing pre-sesión generado por IA.
 *
 * Props:
 *  - appointmentId: int
 *  - defaultOpen: bool (default true)
 *  - compact: bool — versión más chica para el dashboard
 */
export default function PatientBriefing({ appointmentId, defaultOpen = true, compact = false }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState(defaultOpen)

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true)
    try {
      const r = await appointmentsApi.briefing(appointmentId, force)
      setData(r.data)
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Solo el/la psicólogo/a de la cita puede ver el briefing')
      } else {
        toast.error('No se pudo generar el briefing')
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [appointmentId])

  useEffect(() => { if (appointmentId) load(false) }, [appointmentId, load])

  if (!appointmentId) return null

  const highAlerts = data?.signals?.alerts?.filter((a) => a.level === 'high') || []
  const hasContent = data && (data.ai_text || data.signals?.alerts?.length || data.has_prior_session)

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        highAlerts.length > 0
          ? 'border-rose-200 bg-gradient-to-br from-rose-50/80 to-white'
          : 'border-brand-200 bg-gradient-to-br from-brand-50/60 to-white',
      )}
    >
      {/* Header clickable */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/40 transition-colors"
      >
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          highAlerts.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-brand-100 text-brand-700',
        )}>
          {highAlerts.length > 0 ? <AlertTriangle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-semibold text-ink-900 inline-flex items-center gap-2">
            Briefing pre-sesión
            {data?.session_number && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded-full">
                Sesión #{data.session_number}
              </span>
            )}
            {highAlerts.length > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full animate-pulse">
                {highAlerts.length} alerta{highAlerts.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {loading ? 'Generando…' : (data?.ai_available ? 'Análisis automatizado por IA · revisalo antes de actuar' : 'Heurística local (Gemini no disponible)')}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); load(true) }}
          disabled={refreshing || loading}
          className="p-1.5 rounded-lg hover:bg-white/60 text-ink-600 disabled:opacity-40"
          title="Regenerar"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        </button>
        {open ? <ChevronUp className="w-4 h-4 text-ink-500" /> : <ChevronDown className="w-4 h-4 text-ink-500" />}
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {loading ? (
                <div className="py-6 flex justify-center"><Spinner /></div>
              ) : !hasContent ? (
                <p className="text-sm text-ink-500 italic">
                  Sin datos clínicos previos. Esta es la primera sesión que registramos para este/a paciente — no hay historial para resumir.
                </p>
              ) : (
                <>
                  {/* Alertas heurísticas */}
                  {data.signals?.alerts?.length > 0 && (
                    <div className="space-y-1.5">
                      {data.signals.alerts.map((a, i) => (
                        <AlertRow key={i} level={a.level} msg={a.msg} />
                      ))}
                    </div>
                  )}

                  {/* Snapshot rápido */}
                  {!compact && data.signals && (
                    <SignalsSnapshot signals={data.signals} />
                  )}

                  {/* Texto IA */}
                  {data.ai_text ? (
                    <BriefingText text={data.ai_text} />
                  ) : (
                    <div className="text-xs text-ink-600 bg-amber-50 border border-amber-100 rounded-xl p-3">
                      <strong>El resumen completo por IA no está disponible.</strong>{' '}
                      Verificá que <code className="font-mono">GEMINI_API_KEY</code> esté configurada en producción.
                      Mientras tanto, las alertas y métricas arriba son heurísticas locales sin IA.
                    </div>
                  )}

                  <div className="pt-2 border-t border-ink-100/60 text-[10px] text-ink-400">
                    Este briefing es un apoyo. No reemplaza tu juicio clínico ni la lectura de la ficha completa.
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function AlertRow({ level, msg }) {
  const cfg = {
    high:   { cls: 'bg-rose-100 text-rose-800 border-rose-200',     icon: AlertTriangle },
    medium: { cls: 'bg-amber-100 text-amber-800 border-amber-200',  icon: AlertTriangle },
    low:    { cls: 'bg-wellness-50 text-wellness-700 border-wellness-200', icon: TrendingUp },
  }[level] || { cls: 'bg-ink-100 text-ink-700 border-ink-200', icon: Activity }
  const Icon = cfg.icon
  return (
    <div className={cn('flex items-start gap-2 px-3 py-2 rounded-xl border text-xs', cfg.cls)}>
      <Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>{msg}</span>
    </div>
  )
}

function SignalsSnapshot({ signals }) {
  const mood = signals.mood || {}
  const qs = signals.questionnaires || []
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <SnapBox
        icon={Brain}
        label="Ánimo prom."
        value={mood.avg != null ? `${mood.avg}/10` : '—'}
        sub={mood.trend != null ? `tendencia ${mood.trend >= 0 ? '+' : ''}${mood.trend}` : ''}
        tone={mood.avg == null ? 'ink' : mood.avg <= 4 ? 'rose' : mood.avg <= 6 ? 'amber' : 'wellness'}
      />
      <SnapBox
        icon={Activity}
        label="Días bajo (≤3)"
        value={mood.low_days != null ? `${mood.low_days}` : '0'}
        sub={mood.n ? `de ${mood.n} días` : ''}
        tone={!mood.low_days ? 'ink' : mood.low_days >= 5 ? 'rose' : 'amber'}
      />
      <SnapBox
        icon={ClipboardList}
        label="Tareas pend."
        value={`${signals.homework_pending || 0}`}
        sub={`${signals.homework_completed_recent || 0} completadas`}
        tone={signals.homework_pending > 2 ? 'amber' : 'ink'}
      />
      <SnapBox
        icon={qs.length && qs[0].delta < 0 ? TrendingDown : TrendingUp}
        label="Último cuestionario"
        value={qs.length ? `${qs[0].code.toUpperCase()} ${qs[0].latest_score}` : '—'}
        sub={qs.length && qs[0].delta != null ? `delta ${qs[0].delta >= 0 ? '+' : ''}${qs[0].delta}` : ''}
        tone={qs.length && qs[0].crisis_flagged ? 'rose' : (qs.length && qs[0].delta > 2 ? 'amber' : 'ink')}
      />
    </div>
  )
}

function SnapBox({ icon: Icon, label, value, sub, tone = 'ink' }) {
  const cls = {
    ink:      'bg-white border-ink-200',
    rose:     'bg-rose-50 border-rose-200',
    amber:    'bg-amber-50 border-amber-200',
    wellness: 'bg-wellness-50 border-wellness-200',
  }[tone]
  return (
    <div className={cn('rounded-xl border px-3 py-2', cls)}>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-ink-500">
        <Icon className="w-2.5 h-2.5" /> {label}
      </div>
      <div className="text-sm font-bold text-ink-900 tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  )
}

/**
 * Render del markdown del briefing. Soporte mínimo: párrafos, listas, bold,
 * H1/H2/H3. Evitamos meter una dependencia pesada de markdown.
 */
function BriefingText({ text }) {
  // Parser muy simple para el subset que produce el prompt.
  const lines = text.split('\n')
  const out = []
  let listBuffer = []
  const flushList = () => {
    if (listBuffer.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="list-disc list-inside space-y-0.5 text-sm text-ink-700 pl-1 my-1">
          {listBuffer.map((l, i) => <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(l) }} />)}
        </ul>
      )
      listBuffer = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) { flushList(); continue }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(line.slice(2))
      continue
    }
    flushList()
    if (line.startsWith('### ')) {
      out.push(<h4 key={i} className="text-xs font-bold uppercase tracking-wide text-brand-700 mt-3">{line.slice(4)}</h4>)
    } else if (line.startsWith('## ')) {
      out.push(<h3 key={i} className="text-sm font-bold text-ink-900 mt-3" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(3)) }} />)
    } else if (line.startsWith('# ')) {
      out.push(<h2 key={i} className="text-base font-bold text-ink-900 mt-3" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(2)) }} />)
    } else {
      out.push(<p key={i} className="text-sm text-ink-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />)
    }
  }
  flushList()
  return <div className="space-y-1">{out}</div>
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function renderInline(s) {
  // bold **x**, italic *x*, código `x`
  let out = escapeHtml(s)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  out = out.replace(/`([^`]+)`/g, '<code class="font-mono bg-ink-100 px-1 rounded">$1</code>')
  return out
}

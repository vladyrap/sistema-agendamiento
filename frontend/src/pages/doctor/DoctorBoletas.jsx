import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Receipt, Copy, ExternalLink, Check, X, AlertCircle, Calendar, User, Hash, Wallet, FileText, Edit2, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { boletasApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'

const SII_BOHE_URL = 'https://www4.sii.cl/bohe/index.html'

const GLOSA_OPTIONS = [
  'Atención psicológica',
  'Sesión de psicoterapia',
  'Evaluación psicológica',
  'Aplicación de test psicológico',
  'Informe psicológico',
]

const TABS = [
  { id: 'pending',  label: 'Pendientes' },
  { id: 'issued',   label: 'Emitidas' },
  { id: 'all',      label: 'Todas' },
]

function formatCLP(n) {
  return `$${(n || 0).toLocaleString('es-CL')}`
}

export default function DoctorBoletas() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')

  const load = () => {
    setLoading(true)
    boletasApi.list()
      .then((r) => setItems(r.data.items || []))
      .catch(() => toast.error('No se pudieron cargar las boletas'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    if (tab === 'all') return items
    return items.filter((b) => b.status === tab)
  }, [items, tab])

  const totals = useMemo(() => {
    const pending = items.filter((b) => b.status === 'pending')
    const issued  = items.filter((b) => b.status === 'issued')
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, b) => s + (b.amount_clp || 0), 0),
      issuedCount: issued.length,
    }
  }, [items])

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
          <Receipt className="w-6 h-6 text-brand-600" />
          Boletas de honorarios
        </h1>
        <p className="text-ink-500 text-sm mt-1">
          Asistente para emitir boletas en el SII. Una boleta pendiente se crea automáticamente cuando un paciente paga su sesión.
        </p>
      </motion.div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">Pendientes</div>
          <div className="text-2xl font-bold mt-0.5">{totals.pendingCount}</div>
          <div className="text-xs text-ink-500 mt-1">{formatCLP(totals.pendingAmount)} por emitir</div>
        </Card>
        <Card className="p-4">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-ink-500">Emitidas</div>
          <div className="text-2xl font-bold mt-0.5">{totals.issuedCount}</div>
          <div className="text-xs text-ink-500 mt-1">Histórico</div>
        </Card>
        <Card className="p-4 hidden sm:flex flex-col bg-brand-50/60 border-brand-100">
          <div className="text-[11px] uppercase tracking-wide font-semibold text-brand-700">Abrir SII</div>
          <p className="text-xs text-ink-700 mt-1 mb-2 leading-snug">Emite tu boleta de honorarios en sii.cl con los datos prellenados que copies acá.</p>
          <a
            href={SII_BOHE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            sii.cl/bohe <ExternalLink className="w-3 h-3" />
          </a>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-ink-100">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
              tab === t.id
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-900',
            )}
          >
            {t.label}
            {t.id !== 'all' && (
              <span className="ml-1.5 text-[11px] text-ink-400">
                {t.id === 'pending' ? totals.pendingCount : totals.issuedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Receipt}
            title={tab === 'pending' ? 'Sin boletas pendientes' : 'Sin boletas'}
            description={tab === 'pending'
              ? 'Cuando un paciente pague una sesión, vas a ver acá los datos para emitir la boleta en sii.cl.'
              : 'Todavía no marcaste ninguna boleta como emitida.'}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <BoletaCard key={b.id} b={b} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  )
}

function BoletaCard({ b, onChanged }) {
  const [editingGlosa, setEditingGlosa] = useState(false)
  const [glosa, setGlosa] = useState(b.glosa)
  const [folio, setFolio] = useState('')
  const [savingFolio, setSavingFolio] = useState(false)

  async function saveGlosa() {
    try {
      await boletasApi.update(b.id, { glosa })
      toast.success('Glosa actualizada')
      setEditingGlosa(false)
      onChanged()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo actualizar')
    }
  }

  function copyData() {
    const lines = [
      `Receptor:   ${b.patient_name || ''}`,
      `RUT:        ${b.patient_rut || '—'}`,
      `Fecha:      ${format(parseISO(b.service_date), 'dd/MM/yyyy')}`,
      `Glosa:      ${b.glosa}`,
      `Monto:      ${formatCLP(b.amount_clp)} CLP`,
    ].join('\n')
    navigator.clipboard.writeText(lines)
    toast.success('Datos copiados — pegalos en el formulario SII')
  }

  async function markIssued() {
    const f = folio.trim()
    if (!f) return toast.error('Ingresá el folio SII')
    setSavingFolio(true)
    try {
      await boletasApi.issue(b.id, { folio: f })
      toast.success(`Boleta #${f} marcada como emitida`)
      onChanged()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo marcar')
    } finally {
      setSavingFolio(false)
    }
  }

  async function cancel() {
    if (!window.confirm('¿Cancelar esta boleta? (Si la sesión se reembolsó.)')) return
    try {
      await boletasApi.cancel(b.id)
      toast.success('Boleta cancelada')
      onChanged()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo cancelar')
    }
  }

  async function remove() {
    if (!window.confirm('¿Borrar este registro? No se puede deshacer.')) return
    try {
      await boletasApi.remove(b.id)
      toast.success('Borrado')
      onChanged()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'No se pudo borrar')
    }
  }

  const isPending = b.status === 'pending'
  const isIssued = b.status === 'issued'
  const isCancelled = b.status === 'cancelled'

  return (
    <Card className={cn(
      'p-5',
      isPending && 'border-amber-200 bg-amber-50/30',
      isIssued && 'border-wellness-200/60',
      isCancelled && 'opacity-70',
    )}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {/* LEFT */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-sm font-bold text-ink-900">
              <User className="w-3.5 h-3.5 text-ink-400" /> {b.patient_name}
            </span>
            <span className="text-[11px] text-ink-500 tabular-nums inline-flex items-center gap-1">
              <Hash className="w-3 h-3" /> {b.patient_rut || 'sin RUT'}
            </span>
            <StatusBadge status={b.status} />
          </div>

          <div className="flex items-center gap-3 text-[12px] text-ink-600 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {format(parseISO(b.service_date), "d 'de' MMM yyyy", { locale: es })}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-ink-900">
              <Wallet className="w-3 h-3" /> {formatCLP(b.amount_clp)}
            </span>
            {b.folio && (
              <span className="inline-flex items-center gap-1 text-wellness-700 font-semibold">
                <Receipt className="w-3 h-3" /> Folio {b.folio}
              </span>
            )}
          </div>

          {/* Glosa */}
          <div className="text-[12px] text-ink-600 inline-flex items-center gap-2">
            <FileText className="w-3 h-3" />
            {editingGlosa ? (
              <>
                <select
                  value={glosa}
                  onChange={(e) => setGlosa(e.target.value)}
                  className="h-7 rounded-lg border border-ink-200 bg-white px-2 text-xs"
                >
                  {GLOSA_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  {!GLOSA_OPTIONS.includes(glosa) && <option value={glosa}>{glosa}</option>}
                </select>
                <button onClick={saveGlosa} className="text-wellness-700 hover:bg-wellness-50 rounded p-1"><Check className="w-3 h-3" /></button>
                <button onClick={() => { setGlosa(b.glosa); setEditingGlosa(false) }} className="text-ink-500 hover:bg-ink-100 rounded p-1"><X className="w-3 h-3" /></button>
              </>
            ) : (
              <>
                <span>{b.glosa}</span>
                {isPending && (
                  <button onClick={() => setEditingGlosa(true)} className="text-ink-400 hover:text-brand-600">
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Acciones pendiente */}
          {isPending && (
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Button size="sm" variant="secondary" onClick={copyData}>
                <Copy className="w-3.5 h-3.5" /> Copiar datos
              </Button>
              <a
                href={SII_BOHE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Emitir en SII
              </a>
              <div className="inline-flex items-center gap-1.5 ml-auto">
                <Input
                  size="sm"
                  value={folio}
                  onChange={(e) => setFolio(e.target.value)}
                  placeholder="Folio SII"
                  className="w-32 h-9"
                />
                <Button size="sm" onClick={markIssued} disabled={savingFolio}>
                  <Check className="w-3.5 h-3.5" /> Emitida
                </Button>
              </div>
            </div>
          )}

          {isIssued && b.emitted_at && (
            <div className="text-[11px] text-ink-500">
              Emitida el {format(parseISO(b.emitted_at), "d 'de' MMM yyyy 'a las' HH:mm", { locale: es })}
            </div>
          )}
        </div>

        {/* RIGHT: secondary actions */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isPending && (
            <button onClick={remove} className="inline-flex items-center gap-1 text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg">
              <Trash2 className="w-3 h-3" /> Borrar
            </button>
          )}
          {(isPending || isIssued) && !isCancelled && (
            <button onClick={cancel} className="inline-flex items-center gap-1 text-xs text-ink-500 hover:bg-ink-100 px-2 py-1 rounded-lg">
              <AlertCircle className="w-3 h-3" /> Cancelar
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

function StatusBadge({ status }) {
  const cfg = {
    pending:   { label: 'Pendiente', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    issued:    { label: 'Emitida',   cls: 'bg-wellness-100 text-wellness-700 border-wellness-200' },
    cancelled: { label: 'Cancelada', cls: 'bg-ink-100 text-ink-600 border-ink-200' },
  }[status] || { label: status, cls: 'bg-ink-100 text-ink-600 border-ink-200' }
  return (
    <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

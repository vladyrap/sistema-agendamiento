import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ShieldCheck, Plus, Copy, ExternalLink, Play, Square, Trash2, BarChart3, AlertTriangle, Users, Lock, Printer, Search, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { leyKarinApi, companiesApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'

const STATUS_CFG = {
  draft:  { label: 'Borrador',     cls: 'bg-ink-100 text-ink-700 border-ink-200' },
  active: { label: 'Activa',       cls: 'bg-wellness-100 text-wellness-700 border-wellness-200' },
  closed: { label: 'Cerrada',      cls: 'bg-rose-100 text-rose-700 border-rose-200' },
}

export default function AdminLeyKarin() {
  const { user } = useAuth()
  const isCompanyAdmin = user?.role === 'company_admin'
  const [items, setItems] = useState([])
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState(null)
  const navigate = useNavigate()
  // Filtros
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('')

  const load = () => {
    setLoading(true)
    const companiesP = isCompanyAdmin
      ? companiesApi.mine().then((r) => ({ data: [r.data] })).catch(() => ({ data: [] }))
      : companiesApi.list().catch(() => ({ data: [] }))
    Promise.all([leyKarinApi.list(), companiesP])
      .then(([r1, r2]) => {
        setItems(r1.data || [])
        setCompanies(r2.data || [])
      })
      .catch(() => toast.error('No se pudieron cargar las campañas'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [isCompanyAdmin])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items.filter((a) => {
      if (ql && !(`${a.title} ${a.company_name || ''}`).toLowerCase().includes(ql)) return false
      if (statusFilter !== 'all' && a.status !== statusFilter) return false
      if (companyFilter && a.company_id !== parseInt(companyFilter)) return false
      return true
    })
  }, [items, q, statusFilter, companyFilter])

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp} className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-600" />
            Ley Karin — Evaluaciones
          </h1>
          <p className="text-ink-500 text-sm mt-1">
            Campañas de evaluación de riesgo psicosocial laboral (SUSESO/ISTAS-21) en cumplimiento de la Ley 21.643.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="w-4 h-4" /> Nueva campaña
        </Button>
      </motion.div>

      {/* Filtros */}
      {items.length > 0 && (
        <Card className="p-4 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[220px] relative">
            <Search className="w-3.5 h-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por título o empresa…"
              className="w-full h-10 rounded-xl border border-ink-200 pl-9 pr-3 text-sm bg-white focus:outline-none focus:border-brand-400"
            />
          </div>
          <div className="inline-flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-ink-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
            >
              <option value="all">Todos los estados</option>
              <option value="draft">Borradores</option>
              <option value="active">Activas</option>
              <option value="closed">Cerradas</option>
            </select>
          </div>
          {!isCompanyAdmin && companies.length > 1 && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
            >
              <option value="">Todas las empresas</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {(q || statusFilter !== 'all' || companyFilter) && (
            <button type="button" onClick={() => { setQ(''); setStatusFilter('all'); setCompanyFilter('') }} className="text-xs text-ink-500 hover:text-ink-900 px-2">
              Limpiar
            </button>
          )}
          <span className="text-[11px] text-ink-500 ml-auto">
            {filtered.length === items.length ? `${items.length} total` : `${filtered.length} de ${items.length}`}
          </span>
        </Card>
      )}

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Sin campañas todavía"
            description="Crea la primera campaña para una empresa cliente. Recibirás un link público para que sus trabajadores respondan de forma anónima."
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Sin resultados"
            description="Probá ajustar la búsqueda o los filtros."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <AssessmentCard
              key={a.id}
              a={a}
              onClick={() => setSelected(a)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CreateModal
          companies={companies}
          onClose={() => setCreating(false)}
          onCreated={(newOne) => {
            setCreating(false)
            setItems([newOne, ...items])
            setSelected(newOne)
          }}
        />
      )}

      {selected && (
        <DetailModal
          assessment={selected}
          onClose={() => setSelected(null)}
          onChanged={(updated) => {
            setItems(items.map((x) => x.id === updated.id ? updated : x))
            setSelected(updated)
          }}
          onDeleted={(id) => {
            setItems(items.filter((x) => x.id !== id))
            setSelected(null)
          }}
        />
      )}
    </div>
  )
}

function AssessmentCard({ a, onClick }) {
  const status = STATUS_CFG[a.status] || STATUS_CFG.draft
  const completion = a.target_employees ? Math.round((a.response_count * 100) / a.target_employees) : null
  return (
    <Card hover className="p-5 cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border', status.cls)}>
          {status.label}
        </span>
        <span className="text-[10px] text-ink-400 tabular-nums">{format(parseISO(a.created_at), 'd MMM yyyy', { locale: es })}</span>
      </div>
      <h3 className="text-sm font-bold text-ink-900 mt-3 line-clamp-2">{a.title}</h3>
      <p className="text-xs text-ink-600 mt-1.5">{a.company_name}</p>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-xl bg-ink-50 border border-ink-100 p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">Respuestas</div>
          <div className="text-base font-bold tabular-nums">{a.response_count}</div>
        </div>
        <div className="rounded-xl bg-ink-50 border border-ink-100 p-2.5 text-center">
          <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">Completitud</div>
          <div className="text-base font-bold tabular-nums">{completion != null ? `${completion}%` : '—'}</div>
        </div>
      </div>
    </Card>
  )
}

function CreateModal({ companies, onClose, onCreated }) {
  const [form, setForm] = useState({ company_id: '', title: '', target_employees: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.company_id) return toast.error('Selecciona una empresa')
    setSaving(true)
    try {
      const payload = {
        company_id: parseInt(form.company_id, 10),
        title: form.title || undefined,
        target_employees: form.target_employees ? parseInt(form.target_employees, 10) : undefined,
        notes: form.notes,
      }
      const { data } = await leyKarinApi.create(payload)
      toast.success('Campaña creada')
      onCreated(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nueva campaña Ley Karin" size="md">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label>Empresa</Label>
          <select
            value={form.company_id}
            onChange={(e) => setForm({ ...form, company_id: e.target.value })}
            className="w-full h-11 rounded-xl border border-ink-200 px-3 text-sm bg-white"
            required
          >
            <option value="">Selecciona…</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {companies.length === 0 && (
            <p className="text-xs text-amber-700 mt-1.5">No tienes empresas registradas. Crea una en /admin/companies primero.</p>
          )}
        </div>
        <div>
          <Label>Título (opcional)</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej: Evaluación clima 2026 Q2"
          />
        </div>
        <div>
          <Label>Trabajadores totales (opcional)</Label>
          <Input
            type="number"
            min="1"
            value={form.target_employees}
            onChange={(e) => setForm({ ...form, target_employees: e.target.value })}
            placeholder="Para calcular % de participación"
          />
        </div>
        <div>
          <Label>Notas internas</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Creando…' : 'Crear campaña'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function DetailModal({ assessment: initial, onClose, onChanged, onDeleted }) {
  const [a, setA] = useState(initial)
  const [report, setReport] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)

  useEffect(() => {
    setLoadingReport(true)
    leyKarinApi.report(a.id)
      .then((r) => setReport(r.data))
      .catch(() => {})
      .finally(() => setLoadingReport(false))
  }, [a.id])

  async function activate() {
    try {
      const { data } = await leyKarinApi.activate(a.id)
      toast.success('Campaña activa. Link público listo para compartir.')
      setA(data); onChanged(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  async function close() {
    if (!window.confirm('¿Cerrar la campaña? No recibirá más respuestas.')) return
    try {
      const { data } = await leyKarinApi.close(a.id)
      toast.success('Campaña cerrada')
      setA(data); onChanged(data)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  async function remove() {
    if (!window.confirm('¿Borrar la campaña? Solo se pueden borrar campañas en borrador.')) return
    try {
      await leyKarinApi.remove(a.id)
      toast.success('Borrada')
      onDeleted(a.id)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  const publicUrl = `${window.location.origin}/ley-karin/r/${a.share_token}`

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    toast.success('Link copiado')
  }

  return (
    <Modal open onClose={onClose} title={a.title} description={a.company_name} size="xl">
      <div className="space-y-5">
        {/* Estado + acciones */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border', (STATUS_CFG[a.status] || STATUS_CFG.draft).cls)}>
            {(STATUS_CFG[a.status] || STATUS_CFG.draft).label}
          </span>
          <span className="text-xs text-ink-500">{a.response_count} respuestas</span>
          {a.status === 'draft' && (
            <Button size="sm" onClick={activate}><Play className="w-3.5 h-3.5" /> Activar</Button>
          )}
          {a.status === 'active' && (
            <Button size="sm" variant="secondary" onClick={close}><Square className="w-3.5 h-3.5" /> Cerrar</Button>
          )}
          {a.status === 'draft' && (
            <Button size="sm" variant="danger" onClick={remove}><Trash2 className="w-3.5 h-3.5" /> Borrar</Button>
          )}
          {a.response_count >= 3 && (
            <a
              href={`/admin/ley-karin/${a.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold bg-white text-ink-700 border border-ink-200 hover:bg-ink-50"
            >
              <Printer className="w-3.5 h-3.5" /> Descargar PDF
            </a>
          )}
        </div>

        {/* Link público */}
        {a.status === 'active' && (
          <div className="rounded-2xl bg-brand-50/60 border border-brand-200 p-4">
            <div className="text-xs font-bold uppercase tracking-wide text-brand-700 mb-2 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Link anónimo para tus trabajadores
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={publicUrl}
                onClick={(e) => e.target.select()}
                className="flex-1 font-mono text-xs h-10 rounded-xl border border-ink-200 px-3 bg-white"
              />
              <Button size="sm" variant="secondary" onClick={copyLink}><Copy className="w-3.5 h-3.5" /> Copiar</Button>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost"><ExternalLink className="w-3.5 h-3.5" /></Button>
              </a>
            </div>
            <p className="text-[11px] text-ink-600 mt-2">
              Compártelo por email, intranet o slack. Las respuestas son anónimas — el sistema no guarda quién respondió.
            </p>
          </div>
        )}

        {/* Reporte agregado */}
        <div>
          <h3 className="text-sm font-bold text-ink-900 inline-flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-brand-600" /> Reporte agregado
          </h3>
          {loadingReport ? (
            <div className="py-6 flex justify-center"><Spinner /></div>
          ) : !report ? (
            <p className="text-xs text-ink-500 mt-2">Sin reporte disponible.</p>
          ) : !report.report_available ? (
            <div className="mt-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              {report.message}
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Respuestas" value={report.total_responses} />
                <Stat label="Trabajadores" value={report.target_employees ?? '—'} />
                <Stat label="Participación" value={report.completion_pct != null ? `${report.completion_pct}%` : '—'} />
                <Stat label="Peor dimensión" value={report.aggregate?.worst_dimension?.label || '—'} small />
              </div>

              <div className="space-y-2">
                {Object.entries(report.aggregate?.dimensions || {}).map(([code, d]) => (
                  <DimensionRow key={code} code={code} dim={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Stat({ label, value, small }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-3">
      <div className="text-[10px] uppercase tracking-wide font-semibold text-ink-500">{label}</div>
      <div className={cn('font-bold text-ink-900 tabular-nums', small ? 'text-xs mt-1' : 'text-lg mt-0.5')}>{value}</div>
    </div>
  )
}

function DimensionRow({ code, dim }) {
  const { distribution = {}, pct_high = 0 } = dim
  const total = (distribution.low || 0) + (distribution.medium || 0) + (distribution.high || 0)
  const pctLow = total ? Math.round((distribution.low || 0) * 100 / total) : 0
  const pctMed = total ? Math.round((distribution.medium || 0) * 100 / total) : 0
  const pctHigh = total ? Math.round((distribution.high || 0) * 100 / total) : 0
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-sm font-bold text-ink-900">{dim.label}</div>
          <div className="text-[11px] text-ink-500 mt-0.5">{dim.description}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wide text-ink-500 font-semibold">% en riesgo alto</div>
          <div className={cn('text-lg font-bold tabular-nums', pctHigh >= 50 ? 'text-rose-600' : pctHigh >= 25 ? 'text-amber-600' : 'text-wellness-600')}>
            {pctHigh}%
          </div>
        </div>
      </div>
      {/* Barra apilada */}
      <div className="mt-3 h-2.5 rounded-full overflow-hidden flex bg-ink-100">
        <div className="bg-wellness-500" style={{ width: `${pctLow}%` }} title={`Bajo ${pctLow}%`} />
        <div className="bg-amber-500" style={{ width: `${pctMed}%` }} title={`Medio ${pctMed}%`} />
        <div className="bg-rose-500" style={{ width: `${pctHigh}%` }} title={`Alto ${pctHigh}%`} />
      </div>
      <div className="flex gap-3 mt-1.5 text-[10px] text-ink-500">
        <span><span className="inline-block w-2 h-2 rounded-full bg-wellness-500 mr-1" />Bajo {pctLow}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Medio {pctMed}%</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />Alto {pctHigh}%</span>
      </div>
    </div>
  )
}

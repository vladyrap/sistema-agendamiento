import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ShieldAlert, Search, Filter, FileSearch, Eye, Pencil, Download, Trash2, Plus, List,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'

const RESOURCE_TYPES = [
  { value: '',                 label: 'Todos los recursos' },
  { value: 'MedicalRecord',    label: 'Ficha médica' },
  { value: 'PatientNote',      label: 'Nota privada' },
  { value: 'MedicalAttachment',label: 'Adjunto' },
  { value: 'SessionLog',       label: 'Nota de sesión' },
]

const ACTIONS = [
  { value: '',         label: 'Todas las acciones' },
  { value: 'view',     label: 'Ver' },
  { value: 'list',     label: 'Listar' },
  { value: 'create',   label: 'Crear' },
  { value: 'update',   label: 'Editar' },
  { value: 'download', label: 'Descargar' },
  { value: 'delete',   label: 'Eliminar' },
]

const ACTION_ICONS = {
  view:     Eye,
  list:     List,
  create:   Plus,
  update:   Pencil,
  download: Download,
  delete:   Trash2,
}

const ACTION_COLORS = {
  view:     'bg-ink-100 text-ink-700',
  list:     'bg-ink-100 text-ink-700',
  create:   'bg-wellness-100 text-wellness-700',
  update:   'bg-amber-100 text-amber-700',
  download: 'bg-brand-100 text-brand-700',
  delete:   'bg-rose-100 text-rose-700',
}

export default function AdminAuditLog() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [resourceType, setResourceType] = useState('')
  const [action, setAction] = useState('')
  const [days, setDays] = useState(30)
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    try {
      const params = { days, limit: 500 }
      if (resourceType) params.resource_type = resourceType
      if (action) params.action = action
      const r = await adminApi.auditLog(params)
      setEntries(r.data)
    } catch {
      toast.error('No se pudo cargar el log de auditoría')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [resourceType, action, days])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    if (!ql) return entries
    return entries.filter((e) =>
      (e.user_email || '').toLowerCase().includes(ql) ||
      String(e.patient_id || '').includes(ql) ||
      String(e.resource_id || '').includes(ql) ||
      (e.ip_address || '').includes(ql)
    )
  }, [entries, q])

  return (
    <div className="space-y-6">
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-brand-600" /> Auditoría de accesos
        </h1>
        <p className="text-ink-500 text-sm mt-1">
          Registro de quién accedió a fichas clínicas, notas y adjuntos. Inmutable — solo lectura.
        </p>
      </motion.div>

      <Card className="p-4 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <Input leftIcon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por email, paciente, IP..." />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-ink-500" />
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
          >
            {RESOURCE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
        >
          {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
        >
          <option value={1}>Últimas 24 h</option>
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={365}>Último año</option>
        </select>
        <span className="text-[11px] text-ink-500 ml-auto">
          {filtered.length === entries.length ? `${entries.length} accesos` : `${filtered.length} de ${entries.length}`}
        </span>
      </Card>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileSearch}
            title="Sin accesos registrados"
            description="No hay registros que coincidan con los filtros."
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-ink-500 border-b border-ink-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Fecha/Hora</th>
                  <th className="text-left px-4 py-3 font-semibold">Usuario</th>
                  <th className="text-left px-4 py-3 font-semibold">Rol</th>
                  <th className="text-left px-4 py-3 font-semibold">Acción</th>
                  <th className="text-left px-4 py-3 font-semibold">Recurso</th>
                  <th className="text-left px-4 py-3 font-semibold">Paciente</th>
                  <th className="text-left px-4 py-3 font-semibold">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((e) => {
                  const Icon = ACTION_ICONS[e.action] || Eye
                  const color = ACTION_COLORS[e.action] || 'bg-ink-100 text-ink-700'
                  return (
                    <tr key={e.id} className="hover:bg-ink-50/60">
                      <td className="px-4 py-2.5 text-xs text-ink-600 whitespace-nowrap tabular-nums">
                        {e.created_at ? format(parseISO(e.created_at), "dd MMM HH:mm:ss", { locale: es }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="font-semibold text-ink-900 truncate max-w-[200px]">{e.user_email || '—'}</div>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-ink-500">{e.user_role || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${color}`}>
                          <Icon className="w-3 h-3" /> {e.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="font-mono text-ink-700">{e.resource_type}{e.resource_id ? `#${e.resource_id}` : ''}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-600 tabular-nums">{e.patient_id || '—'}</td>
                      <td className="px-4 py-2.5 text-[11px] text-ink-500 font-mono">{e.ip_address || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

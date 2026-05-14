import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Building2, Plus, Search, Mail, Phone, IdCard, ChevronRight, X, Save, Trash2,
  TrendingUp, Users, Sparkles, ChevronLeft, Send, Shield, Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { companiesApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'
import ExportButton from '../../components/ui/ExportButton'

export default function AdminCompanies() {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)  // company en edición/nueva
  const [drillCompany, setDrillCompany] = useState(null)  // company para gestionar miembros
  const [q, setQ] = useState('')

  async function load() {
    setLoading(true)
    try {
      const r = await companiesApi.list()
      setCompanies(r.data)
    } catch {
      toast.error('Error cargando empresas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = companies.filter((c) =>
    !q || c.name.toLowerCase().includes(q.toLowerCase()) || (c.rut || '').includes(q),
  )

  if (drillCompany) {
    return <CompanyDetail
      company={drillCompany}
      onBack={() => { setDrillCompany(null); load() }}
    />
  }

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp} className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-600" /> Empresas / Convenios B2B
          </h1>
          <p className="text-ink-500 text-sm mt-1">
            Gestioná convenios corporativos: empresas, pool de sesiones, empleados.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton endpoint="/exports/companies" filename="empresas.xlsx" />
          <Button onClick={() => setEditing({})}>
            <Plus className="w-4 h-4" /> Nueva empresa
          </Button>
        </div>
      </motion.div>

      {/* Form de alta/edición */}
      <AnimatePresence>
        {editing !== null && (
          <CompanyForm
            company={editing}
            onSaved={() => { setEditing(null); load() }}
            onCancel={() => setEditing(null)}
          />
        )}
      </AnimatePresence>

      {/* Búsqueda */}
      <Card className="p-4">
        <Input leftIcon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o RUT..." />
      </Card>

      {/* Lista */}
      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="Sin empresas registradas"
            description="Crea la primera con el botón de arriba."
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setDrillCompany(c)}
              className="text-left"
            >
              <Card className="p-5 h-full hover:border-brand-200 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ink-900 truncate">{c.name}</div>
                      {c.rut && <div className="text-[11px] text-ink-500">{c.rut}</div>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-brand-600 shrink-0" />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <Stat label="Pool" value={c.sessions_pool} hue="brand" />
                  <Stat label="Usadas" value={c.sessions_used} hue="wellness" />
                  <Stat label="Empleados" value={c.members_count} hue="amber" />
                </div>

                {!c.is_active && (
                  <div className="mt-3 text-[11px] text-ink-500 italic">Inactiva</div>
                )}
                {c.company_admin_name && (
                  <div className="mt-3 text-[11px] text-ink-500 inline-flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Admin: {c.company_admin_name}
                  </div>
                )}
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


function Stat({ label, value, hue = 'brand' }) {
  const colors = {
    brand:    'bg-brand-50 text-brand-700 border-brand-100',
    wellness: 'bg-wellness-50 text-wellness-700 border-wellness-100',
    amber:    'bg-amber-50 text-amber-700 border-amber-100',
  }
  return (
    <div className={`rounded-xl border ${colors[hue]} p-2.5 text-center`}>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide font-semibold opacity-70 mt-0.5">{label}</div>
    </div>
  )
}


function CompanyForm({ company, onSaved, onCancel }) {
  const isEdit = Boolean(company?.id)
  const [data, setData] = useState({
    name: company?.name || '',
    rut: company?.rut || '',
    billing_email: company?.billing_email || '',
    contact_name: company?.contact_name || '',
    contact_phone: company?.contact_phone || '',
    address: company?.address || '',
    email_domain: company?.email_domain || '',
    monthly_cap_per_employee: company?.monthly_cap_per_employee || '',
    sessions_pool: company?.sessions_pool ?? 0,
    notes: company?.notes || '',
    is_active: company?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  function up(k, v) { setData((d) => ({ ...d, [k]: v })) }

  async function submit() {
    if (!data.name.trim()) {
      toast.error('Ponele el nombre')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...data,
        name: data.name.trim(),
        rut: data.rut.trim() || null,
        billing_email: data.billing_email.trim() || null,
        contact_name: data.contact_name.trim() || null,
        contact_phone: data.contact_phone.trim() || null,
        address: data.address.trim() || null,
        email_domain: data.email_domain.trim() || null,
        monthly_cap_per_employee: data.monthly_cap_per_employee ? parseInt(data.monthly_cap_per_employee, 10) : null,
        sessions_pool: parseInt(data.sessions_pool, 10) || 0,
      }
      if (isEdit) {
        await companiesApi.update(company.id, payload)
        toast.success('Empresa actualizada')
      } else {
        await companiesApi.create(payload)
        toast.success('Empresa creada')
      }
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <Card className="p-6 space-y-4 border-brand-200">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold inline-flex items-center gap-2 text-brand-800">
            <Sparkles className="w-4 h-4" /> {isEdit ? 'Editar empresa' : 'Nueva empresa'}
          </h3>
          <button onClick={onCancel} className="p-1 text-ink-500 hover:text-ink-900" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Label>Nombre *</Label>
            <Input value={data.name} onChange={(e) => up('name', e.target.value)} placeholder="Ej: Tech Chile SpA" autoFocus />
          </div>
          <div>
            <Label>RUT</Label>
            <Input value={data.rut} onChange={(e) => up('rut', e.target.value)} placeholder="76.123.456-7" />
          </div>
          <div>
            <Label>Dominio email auto-link</Label>
            <Input value={data.email_domain} onChange={(e) => up('email_domain', e.target.value)} placeholder="empresa.com" />
          </div>
          <div>
            <Label>Email facturación</Label>
            <Input type="email" value={data.billing_email} onChange={(e) => up('billing_email', e.target.value)} />
          </div>
          <div>
            <Label>Contacto (nombre)</Label>
            <Input value={data.contact_name} onChange={(e) => up('contact_name', e.target.value)} />
          </div>
          <div>
            <Label>Contacto (teléfono)</Label>
            <Input value={data.contact_phone} onChange={(e) => up('contact_phone', e.target.value)} />
          </div>
          <div>
            <Label>{isEdit ? 'Pool de sesiones (usa "recargar" para sumar)' : 'Pool inicial de sesiones'}</Label>
            <Input
              type="number"
              min="0"
              value={data.sessions_pool}
              onChange={(e) => up('sessions_pool', e.target.value)}
              disabled={isEdit}
            />
          </div>
          <div>
            <Label>Tope mensual por empleado (opcional)</Label>
            <Input
              type="number"
              min="1"
              placeholder="Sin tope"
              value={data.monthly_cap_per_employee}
              onChange={(e) => up('monthly_cap_per_employee', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Dirección</Label>
            <Input value={data.address} onChange={(e) => up('address', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notas internas</Label>
            <textarea
              value={data.notes}
              onChange={(e) => up('notes', e.target.value)}
              rows={2}
              maxLength={1000}
              className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={saving || !data.name.trim()}>
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Guardando…' : isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Card>
    </motion.div>
  )
}


function CompanyDetail({ company, onBack }) {
  const [data, setData] = useState(company)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [topup, setTopup] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [editing, setEditing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [c, m] = await Promise.all([
        companiesApi.get(company.id),
        companiesApi.members(company.id),
      ])
      setData(c.data)
      setMembers(m.data)
    } catch {
      toast.error('No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function addMember() {
    if (!newEmail.trim()) return
    try {
      await companiesApi.addMember(company.id, newEmail.trim().toLowerCase())
      toast.success('Empleado agregado')
      setNewEmail('')
      setAdding(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo agregar')
    }
  }

  async function removeMember(m) {
    if (!confirm(`¿Quitar a ${m.patient_name} de la empresa?`)) return
    try {
      await companiesApi.removeMember(m.id)
      toast.success('Quitado')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo')
    }
  }

  async function doTopup() {
    const n = parseInt(topup, 10)
    if (!n || n < 1) return
    try {
      await companiesApi.topup(company.id, n)
      toast.success(`Pool recargado con ${n} sesiones`)
      setTopup('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  async function assignAdmin() {
    if (!adminEmail.trim()) return
    try {
      await companiesApi.assignAdmin(company.id, adminEmail.trim().toLowerCase())
      toast.success('Admin asignado')
      setAdminEmail('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    }
  }

  if (loading || !data) {
    return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
  }

  if (editing) {
    return (
      <div className="space-y-5">
        <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <CompanyForm
          company={data}
          onSaved={() => { setEditing(false); load() }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium">
        <ChevronLeft className="w-4 h-4" /> Volver a empresas
      </button>

      {/* Header */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-white flex items-center justify-center">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-ink-500 flex-wrap">
                {data.rut && <span className="inline-flex items-center gap-1"><IdCard className="w-3 h-3" /> {data.rut}</span>}
                {data.billing_email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {data.billing_email}</span>}
                {data.contact_phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {data.contact_phone}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton endpoint={`/exports/company/${data.id}/usage`} filename={`uso_${data.name}.xlsx`} label="Uso (Excel)" />
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5" /> Editar
            </Button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-5">
          <div className="text-xs text-ink-500">Pool actual</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{data.sessions_pool}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-ink-500">Sesiones usadas</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{data.sessions_used}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-ink-500">Empleados activos</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{data.members_count}</div>
        </Card>
        <Card className="p-5">
          <div className="text-xs text-ink-500">Tope mensual</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{data.monthly_cap_per_employee || '∞'}</div>
        </Card>
      </div>

      {/* Top-up + Admin assign */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-brand-600" /> Recargar pool
          </h3>
          <div className="flex items-center gap-2">
            <Input type="number" min="1" placeholder="Sesiones a agregar" value={topup} onChange={(e) => setTopup(e.target.value)} className="flex-1" />
            <Button onClick={doTopup} disabled={!topup}>
              <Send className="w-3.5 h-3.5" /> Sumar
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-brand-600" /> Admin de empresa
          </h3>
          {data.company_admin_name ? (
            <div className="text-sm">
              <div className="font-semibold text-ink-900">{data.company_admin_name}</div>
              <p className="text-xs text-ink-500 mt-1">Tiene acceso al portal de la empresa con métricas anonimizadas.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input type="email" placeholder="email-admin@empresa.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="flex-1" />
              <Button onClick={assignAdmin} disabled={!adminEmail}>
                <Send className="w-3.5 h-3.5" /> Asignar
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Empleados */}
      <Card>
        <div className="px-5 py-4 border-b border-ink-100 flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-semibold inline-flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600" /> Empleados ({members.length})
          </h3>
          {!adding && <Button variant="secondary" size="sm" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Agregar</Button>}
        </div>
        {adding && (
          <div className="px-5 py-4 border-b border-ink-100 bg-brand-50/40 flex items-center gap-2">
            <Input type="email" placeholder="email del empleado" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={addMember} disabled={!newEmail}>Agregar</Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setNewEmail('') }}>Cancelar</Button>
          </div>
        )}
        {members.length === 0 ? (
          <EmptyState icon={Users} title="Sin empleados" description={adding ? "" : "Agregá el primero arriba."} />
        ) : (
          <ul className="divide-y divide-ink-100">
            {members.map((m) => (
              <li key={m.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-ink-50/60 transition-colors">
                <Avatar name={m.patient_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-900 truncate">{m.patient_name}</div>
                  <div className="text-[11px] text-ink-500 truncate">
                    {m.patient_email}
                    {m.patient_phone && ` · ${m.patient_phone}`}
                  </div>
                </div>
                <div className="text-xs text-ink-500 shrink-0">
                  {m.sessions_used} {m.sessions_used === 1 ? 'sesión' : 'sesiones'} usadas
                </div>
                {!m.is_active ? (
                  <span className="text-[10px] uppercase font-bold bg-ink-100 text-ink-600 px-2 py-0.5 rounded-full">Inactivo</span>
                ) : (
                  <button onClick={() => removeMember(m)} className="text-rose-600 hover:bg-rose-50 p-1 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

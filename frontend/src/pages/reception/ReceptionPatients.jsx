import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Phone, Mail, IdCard, Copy, Check, Users, FileText, Filter } from 'lucide-react'
import { patientsApi } from '../../services/api'
import { Card, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { Avatar } from '../../components/ui/Avatar'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'

const empty = { email: '', first_name: '', last_name: '', phone: '', rut: '' }

export default function ReceptionPatients() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(empty)
  const [submitting, setSubmitting] = useState(false)
  const [credentials, setCredentials] = useState(null) // { email, password }
  const [copied, setCopied] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [missingFilter, setMissingFilter] = useState('all')  // all | no_rut | no_phone

  const search = (q) => {
    setLoading(true)
    patientsApi.search(q).then((r) => setResults(r.data)).finally(() => setLoading(false))
  }

  useEffect(() => {
    const t = setTimeout(() => search(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const filteredResults = useMemo(() => {
    return results.filter((u) => {
      if (statusFilter !== 'all' && (u.patient_status || 'active') !== statusFilter) return false
      if (missingFilter === 'no_rut'   && u.rut) return false
      if (missingFilter === 'no_phone' && u.phone) return false
      return true
    })
  }, [results, statusFilter, missingFilter])

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  const handleCreate = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data } = await patientsApi.create({
        ...form,
        rut: form.rut || null,
        phone: form.phone || null,
      })
      setCredentials({ email: data.user.email, password: data.generated_password })
      setForm(empty)
      search(query)
      toast.success('Paciente creado')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al crear paciente')
    } finally {
      setSubmitting(false)
    }
  }

  const copyCredentials = async () => {
    if (!credentials) return
    const text = `Email: ${credentials.email}\nContraseña: ${credentials.password}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-sm text-ink-500 mt-1">Busca o crea pacientes para reservar en mostrador.</p>
        </div>
        <Button onClick={() => { setForm(empty); setCreateOpen(true) }}>
          <UserPlus className="w-4 h-4" /> Nuevo paciente
        </Button>
      </div>

      <Card className="p-4 flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <Input
            placeholder="Buscar por nombre, email o RUT..."
            leftIcon={Search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-ink-500" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="all">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="in_treatment">En tratamiento</option>
            <option value="inactive">Inactivos</option>
            <option value="discharged">Dados de alta</option>
          </select>
        </div>
        <select value={missingFilter} onChange={(e) => setMissingFilter(e.target.value)} className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm">
          <option value="all">Datos completos o no</option>
          <option value="no_rut">Sin RUT</option>
          <option value="no_phone">Sin teléfono</option>
        </select>
        {(statusFilter !== 'all' || missingFilter !== 'all' || query) && (
          <button type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setMissingFilter('all') }} className="text-xs text-ink-500 hover:text-ink-900 px-2">
            Limpiar
          </button>
        )}
        <span className="text-[11px] text-ink-500 ml-auto">
          {filteredResults.length === results.length ? `${results.length}` : `${filteredResults.length} de ${results.length}`}
        </span>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : filteredResults.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin resultados"
          description={query ? 'Probá con otro término o crea un paciente nuevo.' : 'Empieza a buscar o crea un paciente.'}
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  {['Paciente', 'RUT', 'Email', 'Teléfono', ''].map((h, i) => (
                    <th key={i} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-ink-500 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((u) => (
                  <tr key={u.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${u.first_name} ${u.last_name}`} size="sm" />
                        <span className="font-semibold text-ink-900">{u.first_name} {u.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-ink-600 tabular-nums">{u.rut || '—'}</td>
                    <td className="px-5 py-3.5 text-ink-600">{u.email}</td>
                    <td className="px-5 py-3.5 text-ink-600 tabular-nums">{u.phone || '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link to={`/reception/patients/${u.id}`}>
                        <Button variant="secondary" size="sm" title="Ver ficha completa">
                          <FileText className="w-3.5 h-3.5" /> Ficha
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setCredentials(null) }}
        title={credentials ? 'Paciente creado' : 'Nuevo paciente'}
        description={credentials
          ? 'Entrega estas credenciales al paciente. No se mostrarán nuevamente.'
          : 'Datos mínimos para registrar el paciente al vuelo.'}
      >
        {credentials ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-ink-200 bg-ink-50 p-4 font-mono text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-ink-500">Email</span>
                <span className="text-ink-900 truncate">{credentials.email}</span>
              </div>
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className="text-ink-500">Contraseña</span>
                <span className="text-ink-900 font-bold tabular-nums">{credentials.password}</span>
              </div>
            </div>
            <Button variant="secondary" className="w-full" onClick={copyCredentials}>
              {copied ? <><Check className="w-4 h-4" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar</>}
            </Button>
            <Button className="w-full" onClick={() => { setCreateOpen(false); setCredentials(null) }}>
              Listo
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nombre</Label><Input required value={form.first_name} onChange={set('first_name')} /></div>
              <div><Label>Apellido</Label><Input required value={form.last_name} onChange={set('last_name')} /></div>
            </div>
            <div><Label>Email</Label><Input type="email" required leftIcon={Mail} value={form.email} onChange={set('email')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>RUT</Label><Input leftIcon={IdCard} placeholder="12345678-9" value={form.rut} onChange={set('rut')} /></div>
              <div><Label>Teléfono</Label><Input leftIcon={Phone} placeholder="+56 9..." value={form.phone} onChange={set('phone')} /></div>
            </div>
            <div className="text-xs text-ink-500 p-3 rounded-lg bg-amber-50 border border-amber-100">
              Se generará una contraseña automática. La verás una sola vez al terminar.
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              <UserPlus className="w-4 h-4" /> {submitting ? 'Creando...' : 'Crear paciente'}
            </Button>
          </form>
        )}
      </Modal>
    </motion.div>
  )
}

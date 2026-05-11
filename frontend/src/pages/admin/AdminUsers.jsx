import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Users, Search, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { fadeInUp } from '../../lib/motion'

const roles = [
  { id: '',        label: 'Todos' },
  { id: 'patient', label: 'Pacientes' },
  { id: 'doctor',  label: 'Médicos' },
  { id: 'admin',   label: 'Admins' },
]

const roleConfig = {
  patient: { label: 'Paciente',      tone: 'brand'   },
  doctor:  { label: 'Médico',        tone: 'success' },
  admin:   { label: 'Administrador', tone: 'warning' },
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [query, setQuery] = useState('')

  const load = () => {
    setLoading(true)
    adminApi.listUsers(roleFilter ? { role: roleFilter } : {})
      .then((r) => setUsers(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(load, [roleFilter])

  const handleToggle = async (id) => {
    try {
      await adminApi.toggleUserActive(id)
      toast.success('Estado actualizado')
      load()
    } catch {
      toast.error('Error al actualizar')
    }
  }

  const filtered = users.filter((u) =>
    !query.trim() ||
    `${u.first_name} ${u.last_name} ${u.email} ${u.rut || ''}`.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
        <p className="text-sm text-ink-500 mt-1">{users.length} cuentas registradas en la plataforma.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Buscar por nombre, email o RUT..." leftIcon={Search} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoleFilter(r.id)}
              className={cn(
                'px-3.5 h-11 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all',
                roleFilter === r.id
                  ? 'bg-ink-900 text-white border-ink-900'
                  : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users} title="No hay usuarios" description="Ajusta los filtros para ver resultados." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  {['Usuario', 'RUT', 'Rol', 'Estado', 'Registro', ''].map((h) => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] uppercase tracking-wider text-ink-500 font-bold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const role = roleConfig[u.role] || { label: u.role, tone: 'ink' }
                  return (
                    <tr key={u.id} className="border-b border-ink-100 last:border-b-0 hover:bg-ink-50/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${u.first_name} ${u.last_name}`} size="sm" />
                          <div>
                            <div className="font-semibold text-ink-900">{u.first_name} {u.last_name}</div>
                            <div className="text-xs text-ink-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-ink-600 tabular-nums">{u.rut || '—'}</td>
                      <td className="px-5 py-3.5"><Badge tone={role.tone}>{role.label}</Badge></td>
                      <td className="px-5 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', u.is_active ? 'text-wellness-700' : 'text-red-700')}>
                          <span className={cn('w-1.5 h-1.5 rounded-full', u.is_active ? 'bg-wellness-500' : 'bg-red-500')} />
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-ink-500 tabular-nums">
                        {format(parseISO(u.created_at), 'dd MMM yyyy', { locale: es })}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex gap-1.5">
                          {u.role === 'patient' && (
                            <Link to={`/admin/patients/${u.id}`}>
                              <Button variant="secondary" size="sm" title="Ver ficha completa">
                                <FileText className="w-3.5 h-3.5" /> Ficha
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant={u.is_active ? 'danger' : 'success'}
                            size="sm"
                            onClick={() => handleToggle(u.id)}
                          >
                            {u.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </motion.div>
  )
}

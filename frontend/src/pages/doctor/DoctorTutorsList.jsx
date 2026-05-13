import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield, Search, Mail, Phone, IdCard, AlertTriangle, Bell, Eye, Link2, Send,
  ChevronRight, Filter, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { tutorsApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Avatar } from '../../components/ui/Avatar'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'

const FILTERS = {
  all:     { label: 'Todos',         fn: () => true },
  legal:   { label: 'Tutores legales', fn: (t) => t.is_legal_guardian },
  linked:  { label: 'Con cuenta',    fn: (t) => t.has_account },
  minor_patient: { label: 'De pacientes menores', fn: (t) => t.patient_is_minor },
}

export default function DoctorTutorsList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    tutorsApi.doctorTutors()
      .then((r) => setItems(r.data))
      .catch(() => toast.error('No se pudieron cargar los tutores'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    let out = items.filter(FILTERS[filter].fn)
    if (ql) {
      out = out.filter((t) =>
        t.name.toLowerCase().includes(ql) ||
        (t.email || '').toLowerCase().includes(ql) ||
        (t.phone || '').toLowerCase().includes(ql) ||
        t.patient_name.toLowerCase().includes(ql) ||
        t.relationship_label.toLowerCase().includes(ql),
      )
    }
    // Agrupar por paciente
    const byPatient = new Map()
    out.forEach((t) => {
      if (!byPatient.has(t.patient_id)) {
        byPatient.set(t.patient_id, { patient_id: t.patient_id, patient_name: t.patient_name, patient_is_minor: t.patient_is_minor, tutors: [] })
      }
      byPatient.get(t.patient_id).tutors.push(t)
    })
    return Array.from(byPatient.values())
  }, [items, q, filter])

  async function alertTutor(t) {
    const message = prompt(`Mandar alerta a ${t.name} (paciente: ${t.patient_name}). Mensaje (opcional):`, '')
    if (message === null) return
    try {
      await tutorsApi.alert(t.tutor_id, message)
      toast.success('Alerta enviada')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo enviar')
    }
  }

  const totalTutors = items.length
  const legalCount = items.filter((t) => t.is_legal_guardian).length
  const linkedCount = items.filter((t) => t.has_account).length

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
          <Shield className="w-6 h-6 text-brand-600" />
          Tutores de mis pacientes
        </h1>
        <p className="text-ink-500 text-sm mt-1">
          {totalTutors === 0
            ? 'Tus pacientes aún no tienen tutores designados.'
            : `${totalTutors} ${totalTutors === 1 ? 'tutor' : 'tutores'} en total · ${legalCount} legales · ${linkedCount} con cuenta vinculada`}
        </p>
      </motion.div>

      <Card className="p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <Input
            leftIcon={Search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por tutor, paciente, email o relación…"
          />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-ink-500" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm"
          >
            {Object.entries(FILTERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Shield}
            title={items.length === 0 ? 'Sin tutores aún' : 'Sin resultados'}
            description={items.length === 0
              ? 'Cuando tus pacientes designen tutores, aparecerán aquí.'
              : 'Probá ajustar la búsqueda o los filtros.'}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {filtered.map((group, idx) => (
            <motion.div
              key={group.patient_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.03 }}
            >
              <Card className="overflow-hidden">
                {/* Header del grupo: paciente */}
                <Link
                  to={`/doctor/patients/${group.patient_id}`}
                  className="flex items-center gap-3 px-5 py-3 border-b border-ink-100 hover:bg-ink-50 group transition-colors"
                >
                  <Avatar name={group.patient_name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink-900 truncate">
                      {group.patient_name}
                    </div>
                    <div className="text-[11px] text-ink-500">
                      {group.tutors.length} {group.tutors.length === 1 ? 'tutor' : 'tutores'}
                      {group.patient_is_minor && (
                        <span className="ml-2 inline-flex items-center gap-1 text-amber-700 font-semibold">
                          <AlertTriangle className="w-2.5 h-2.5" /> Menor de edad
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-400 group-hover:text-brand-600 transition-colors" />
                </Link>

                {/* Lista de tutores */}
                <ul className="divide-y divide-ink-100">
                  {group.tutors.map((t) => (
                    <li key={t.tutor_id} className="px-5 py-4 hover:bg-ink-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <Avatar name={t.name} size="md" className="shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-ink-900 truncate">{t.name}</span>
                            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-ink-100 text-ink-700 border border-ink-200">
                              {t.relationship_label}
                            </span>
                            {t.is_legal_guardian && (
                              <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                Tutor legal
                              </span>
                            )}
                            {t.has_account && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-wellness-100 text-wellness-700 border border-wellness-200">
                                <Link2 className="w-2.5 h-2.5" /> Cuenta
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-ink-600 flex-wrap">
                            {t.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {t.email}</span>}
                            {t.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {t.phone}</span>}
                            {t.rut && <span className="inline-flex items-center gap-1"><IdCard className="w-3 h-3" /> {t.rut}</span>}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-ink-500 flex-wrap">
                            {t.notify_on_crisis && (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> Crisis
                              </span>
                            )}
                            {t.notify_on_appointments && (
                              <span className="inline-flex items-center gap-1 text-brand-600 font-medium">
                                <Bell className="w-3 h-3" /> Citas
                              </span>
                            )}
                            {t.has_account && (
                              <span className="inline-flex items-center gap-1 text-wellness-600 font-medium">
                                <Eye className="w-3 h-3" /> Ve perfil
                              </span>
                            )}
                          </div>

                          {t.notes && (
                            <p className="text-xs text-ink-600 italic mt-1.5 leading-relaxed">"{t.notes}"</p>
                          )}
                        </div>

                        <button
                          onClick={() => alertTutor(t)}
                          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg"
                          title="Enviar alerta manual"
                        >
                          <Send className="w-3.5 h-3.5" /> Alertar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

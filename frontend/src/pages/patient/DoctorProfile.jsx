import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Star, MapPin, Clock, ShieldCheck, ArrowLeft, Calendar, Video, Languages,
  Award, ThumbsUp, Stethoscope, Brain, BellRing,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { waitlistApi } from '../../services/api'
import { Modal } from '../../components/ui/Modal'
import { Input, Label } from '../../components/ui/Input'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { doctorsApi, reviewsApi } from '../../services/api'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { Stars } from '../../components/ui/Stars'
import { fadeInUp } from '../../lib/motion'
import { formatCLP } from '../../lib/format'

export default function DoctorProfile() {
  const { id } = useParams()
  const [doctor, setDoctor] = useState(null)
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistFrom, setWaitlistFrom] = useState('')
  const [waitlistTo, setWaitlistTo] = useState('')
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)

  const submitWaitlist = async (e) => {
    e.preventDefault()
    if (!waitlistFrom || !waitlistTo) return toast.error('Indica las fechas')
    setWaitlistSubmitting(true)
    try {
      await waitlistApi.join({ doctor_id: parseInt(id), desired_from: waitlistFrom, desired_to: waitlistTo })
      toast.success('Listo. Te avisaremos por email/SMS cuando se libere un cupo.')
      setWaitlistOpen(false)
      setWaitlistFrom(''); setWaitlistTo('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error')
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  useEffect(() => {
    Promise.all([
      doctorsApi.get(id).then((r) => setDoctor(r.data)),
      reviewsApi.listForDoctor(id).then((r) => setReviews(r.data)).catch(() => setReviews([])),
    ]).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (!doctor) return <div className="py-16 text-center text-ink-500">Profesional no encontrado.</div>

  const fullName = `${doctor.user.first_name} ${doctor.user.last_name}`
  const SpecialtyIcon = doctor.specialty.name.toLowerCase().includes('psic') ? Brain : Stethoscope

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <Link to="/patient/search" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium">
        <ArrowLeft className="w-4 h-4" /> Volver a la búsqueda
      </Link>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: profile */}
        <div className="space-y-6">
          {/* Hero card */}
          <Card className="p-0 overflow-hidden">
            <div className="h-32 bg-gradient-to-br from-brand-500 via-brand-700 to-ink-900 relative">
              <div className="absolute inset-0 bg-grid-dark opacity-30" />
            </div>
            <div className="px-6 sm:px-8 pb-6 -mt-12 relative">
              <div className="flex items-end justify-between gap-4 flex-wrap">
                <Avatar name={fullName} src={doctor?.user?.photo_url} size="2xl" className="ring-4 ring-white shadow-soft-lg" />
              </div>
              <div className="mt-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dr(a). {fullName}</h1>
                  <Badge tone="success" dot>Verificado</Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-brand-600 font-medium">
                  <SpecialtyIcon className="w-4 h-4" />
                  <span>{doctor.specialty.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-ink-600">
                  {doctor.rating_count > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-ink-900 tabular-nums">{doctor.rating_avg?.toFixed(1)}</span>
                      <span className="text-ink-500">({doctor.rating_count} {doctor.rating_count === 1 ? 'reseña' : 'reseñas'})</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-ink-400">
                      <Star className="w-4 h-4" />
                      <span>Aún sin reseñas</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-ink-400" />
                    {doctor.consultation_duration} min
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge tone="brand"><MapPin className="w-3 h-3" /> Presencial</Badge>
                  <Badge tone="success"><Video className="w-3 h-3" /> Teleconsulta</Badge>
                  <Badge tone="outline"><Languages className="w-3 h-3" /> Español</Badge>
                </div>
              </div>
            </div>
          </Card>

          {/* About */}
          <Card className="p-6 sm:p-7">
            <h2 className="text-base font-semibold tracking-tight mb-3">Sobre el profesional</h2>
            <p className="text-[15px] text-ink-700 leading-relaxed text-pretty">
              {doctor.bio || 'Profesional comprometido con brindar atención de calidad, cercana y centrada en el paciente. Atención presencial y por videollamada.'}
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mt-6">
              {[
                { icon: Award,      label: 'Experiencia',  value: '10+ años' },
                { icon: ThumbsUp,   label: 'Recomendado',  value: '98%' },
                { icon: ShieldCheck,label: 'Verificado',   value: 'Colegio médico' },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                  <s.icon className="w-4 h-4 text-brand-600" />
                  <div className="text-xs text-ink-500 mt-2">{s.label}</div>
                  <div className="text-sm font-semibold text-ink-900">{s.value}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Reviews */}
          <Card className="p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold tracking-tight">
                Reseñas {reviews.length > 0 && <span className="text-ink-400 font-normal">· {reviews.length}</span>}
              </h2>
              {doctor.rating_count > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold tabular-nums">{doctor.rating_avg?.toFixed(1)}</span>
                  <span className="text-ink-400">/ 5</span>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="py-8 text-center">
                <Star className="w-8 h-8 text-ink-300 mx-auto" />
                <p className="text-sm text-ink-500 mt-2">Este profesional aún no tiene reseñas.</p>
                <p className="text-xs text-ink-400 mt-0.5">Sé el primero después de tu primera consulta.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {reviews.slice(0, 10).map((r) => {
                  const initials = `${r.patient.first_name[0]}. ${r.patient.last_name[0]}.`
                  return (
                    <div key={r.id} className="flex gap-3">
                      <Avatar name={`${r.patient.first_name} ${r.patient.last_name}`} size="sm" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink-900">
                            {r.patient.first_name} {r.patient.last_name[0]}.
                          </span>
                          <Stars value={r.rating} size="xs" />
                          <span className="text-xs text-ink-400 tabular-nums">
                            {format(parseISO(r.created_at), "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        {r.comment && (
                          <p className="text-sm text-ink-700 mt-1 leading-relaxed text-pretty">{r.comment}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: sticky booking sidebar */}
        <div>
          <div className="lg:sticky lg:top-24 space-y-4">
            <Card className="p-6">
              <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">Valor consulta</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-bold tracking-tight tabular-nums">
                  {doctor.consultation_price > 0 ? formatCLP(doctor.consultation_price) : 'Sin costo'}
                </span>
                <span className="text-xs text-ink-500">/ {doctor.consultation_duration} min</span>
              </div>

              <Link to={`/patient/book/${doctor.id}`} className="block mt-5">
                <Button size="lg" className="w-full">
                  <Calendar className="w-4 h-4" /> Agendar hora
                </Button>
              </Link>

              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => setWaitlistOpen(true)}>
                <BellRing className="w-3.5 h-3.5" /> Apuntarme a lista de espera
              </Button>

              <ul className="mt-5 space-y-2.5 text-sm text-ink-600">
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-wellness-600" /> Cancelación gratuita hasta 24h antes</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-wellness-600" /> Confirmación inmediata</li>
                <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-wellness-600" /> Recordatorio por email</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>

      <Modal
        open={waitlistOpen}
        onClose={() => setWaitlistOpen(false)}
        title="Lista de espera"
        description="Indica el rango de fechas en que te interesaría agendar. Te avisaremos por email/SMS cuando se libere un cupo."
      >
        <form onSubmit={submitWaitlist} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Desde</Label>
              <Input type="date" required value={waitlistFrom} onChange={(e) => setWaitlistFrom(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" required value={waitlistTo} onChange={(e) => setWaitlistTo(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={waitlistSubmitting}>
            {waitlistSubmitting ? 'Apuntando...' : 'Apuntarme'}
          </Button>
        </form>
      </Modal>
    </motion.div>
  )
}

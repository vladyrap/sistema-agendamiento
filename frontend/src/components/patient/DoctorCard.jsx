import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Clock, Star, ArrowUpRight, Stethoscope, Brain } from 'lucide-react'
import { Avatar } from '../ui/Avatar'
import { Badge } from '../ui/Badge'
import { staggerItem } from '../../lib/motion'
import { formatCLP } from '../../lib/format'

const specialtyIcon = (name = '') => {
  const n = name.toLowerCase()
  if (n.includes('psic') || n.includes('neuro')) return Brain
  return Stethoscope
}

export function DoctorCard({ doctor }) {
  const fullName = `${doctor.user.first_name} ${doctor.user.last_name}`
  const SpecialtyIcon = specialtyIcon(doctor.specialty.name)

  return (
    <motion.div variants={staggerItem}>
      <Link
        to={`/patient/doctors/${doctor.id}`}
        className="group block rounded-2xl bg-white border border-ink-200/70 p-5 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:shadow-soft-lg hover:border-brand-200"
      >
        <div className="flex items-start gap-4">
          <Avatar name={fullName} src={doctor.user.photo_url} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold text-ink-900 tracking-tight truncate">
                Dr(a). {fullName}
              </h3>
              <ArrowUpRight className="w-4 h-4 text-ink-400 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600 shrink-0" strokeWidth={2} />
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-brand-600">
              <SpecialtyIcon className="w-3.5 h-3.5" strokeWidth={2.2} />
              <span className="text-xs font-medium">{doctor.specialty.name}</span>
            </div>
            <div className="flex items-center gap-1 mt-1.5">
              {doctor.rating_count > 0 ? (
                <>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-semibold text-ink-700 tabular-nums">
                    {doctor.rating_avg?.toFixed(1)}
                  </span>
                  <span className="text-xs text-ink-400">
                    · {doctor.rating_count} {doctor.rating_count === 1 ? 'reseña' : 'reseñas'}
                  </span>
                </>
              ) : (
                <>
                  <Star className="w-3.5 h-3.5 text-ink-300" />
                  <span className="text-xs text-ink-400">Sin reseñas aún</span>
                </>
              )}
            </div>
          </div>
        </div>

        {doctor.bio && (
          <p className="text-sm text-ink-600 mt-4 line-clamp-2 leading-relaxed text-pretty">
            {doctor.bio}
          </p>
        )}

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Badge tone="outline">
            <Clock className="w-3 h-3" strokeWidth={2.2} />
            {doctor.consultation_duration} min
          </Badge>
          <Badge tone="outline">
            <MapPin className="w-3 h-3" strokeWidth={2.2} />
            Presencial · Online
          </Badge>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-ink-100">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400 font-semibold">
              {doctor.consultation_price > 0 ? 'Consulta' : 'Modalidad'}
            </div>
            <div className="text-sm font-bold text-ink-900 tabular-nums">
              {doctor.consultation_price > 0 ? formatCLP(doctor.consultation_price) : 'Sin costo'}
            </div>
          </div>
          <span className="text-xs font-semibold text-brand-600 group-hover:text-brand-700">
            Ver perfil →
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

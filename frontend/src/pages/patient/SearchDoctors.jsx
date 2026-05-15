import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, Stethoscope, Brain, Sparkles, ArrowUpDown } from 'lucide-react'
import { doctorsApi, specialtiesApi } from '../../services/api'
import { Input } from '../../components/ui/Input'
import { DoctorCard } from '../../components/patient/DoctorCard'
import { EmptyState } from '../../components/ui/EmptyState'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'
import { stagger } from '../../lib/motion'

const modalities = [
  { id: 'all',        label: 'Todas' },
  { id: 'in_person',  label: 'Presencial' },
  { id: 'online',     label: 'Online' },
]

export default function SearchDoctors() {
  const [doctors, setDoctors] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [specialtyId, setSpecialtyId] = useState('')
  const [query, setQuery] = useState('')
  const [modality, setModality] = useState('all')
  const [loading, setLoading] = useState(true)
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState('rating')  // rating | price_asc | price_desc | name

  useEffect(() => {
    specialtiesApi.list().then((r) => setSpecialties(r.data))
  }, [])

  useEffect(() => {
    setLoading(true)
    doctorsApi
      .list(specialtyId ? { specialty_id: specialtyId } : {})
      .then((r) => setDoctors(r.data))
      .finally(() => setLoading(false))
  }, [specialtyId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const maxP = maxPrice ? parseInt(maxPrice) : null
    let out = doctors.filter((d) => {
      if (q && !`${d.user.first_name} ${d.user.last_name} ${d.specialty.name}`.toLowerCase().includes(q)) return false
      if (maxP !== null && (d.consultation_price || 0) > maxP) return false
      return true
    })
    out = [...out].sort((a, b) => {
      if (sortBy === 'price_asc')  return (a.consultation_price || 0) - (b.consultation_price || 0)
      if (sortBy === 'price_desc') return (b.consultation_price || 0) - (a.consultation_price || 0)
      if (sortBy === 'name')       return `${a.user.first_name} ${a.user.last_name}`.localeCompare(`${b.user.first_name} ${b.user.last_name}`)
      // rating (default)
      return (b.rating_avg ?? 0) - (a.rating_avg ?? 0)
    })
    return out
  }, [doctors, query, maxPrice, sortBy])

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-white to-wellness-50/40 border border-ink-100 px-6 sm:px-10 py-12 sm:py-14">
        <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full bg-brand-200/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-wellness-200/30 blur-3xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative max-w-2xl"
        >
          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-white border border-brand-100 px-2.5 py-1 rounded-full mb-4">
            <Sparkles className="w-3 h-3" />
            Más de 200 profesionales verificados
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tightest leading-tight text-balance">
            Encuentra al profesional<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-wellness-600">ideal para ti.</span>
          </h1>
          <p className="text-ink-500 mt-3 text-pretty">
            Psicólogos/as con disponibilidad real, presencial o por videollamada.
          </p>

          {/* Search */}
          <div className="mt-7 flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                placeholder="Buscar por nombre o especialidad..."
                leftIcon={Search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 text-base shadow-soft"
              />
            </div>
            <div className="relative">
              <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
              <select
                value={specialtyId}
                onChange={(e) => setSpecialtyId(e.target.value)}
                className="h-12 pl-10 pr-9 rounded-xl border border-ink-200 bg-white text-sm text-ink-700 font-medium hover:border-ink-300 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all appearance-none shadow-soft cursor-pointer"
                style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
              >
                <option value="">Todas las especialidades</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Modality chips */}
          <div className="flex flex-wrap gap-1.5 mt-4">
            {modalities.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModality(m.id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                  modality === m.id
                    ? 'bg-ink-900 text-white border-ink-900 shadow-sm'
                    : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Filtros secundarios: precio máximo + orden */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs">
            <label className="inline-flex items-center gap-1.5 text-ink-600">
              Precio máximo
              <input
                type="number"
                min={0}
                step={1000}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="Sin tope"
                className="h-9 w-28 rounded-xl border border-ink-200 px-2 text-sm bg-white tabular-nums"
              />
              <span className="text-ink-400">CLP</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-ink-600">
              <ArrowUpDown className="w-3 h-3" />
              Ordenar
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="h-9 rounded-xl border border-ink-200 bg-white px-2 text-sm">
                <option value="rating">Mejor evaluación</option>
                <option value="price_asc">Menor precio</option>
                <option value="price_desc">Mayor precio</option>
                <option value="name">Nombre A-Z</option>
              </select>
            </label>
            {(query || maxPrice || sortBy !== 'rating' || specialtyId) && (
              <button type="button" onClick={() => { setQuery(''); setMaxPrice(''); setSortBy('rating'); setSpecialtyId('') }} className="text-ink-500 hover:text-ink-900 underline">
                Limpiar filtros
              </button>
            )}
          </div>
        </motion.div>
      </section>

      {/* Results */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm text-ink-500">
            {loading ? 'Buscando...' : `${filtered.length} ${filtered.length === 1 ? 'profesional' : 'profesionales'}`}
          </h2>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No encontramos profesionales"
            description="Prueba con otra búsqueda o cambia el filtro de especialidad."
          />
        ) : (
          <motion.div
            variants={stagger(0.05)}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {filtered.map((d) => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </motion.div>
        )}
      </section>
    </div>
  )
}

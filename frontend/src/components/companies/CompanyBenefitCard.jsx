import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Building2, Sparkles, AlertCircle } from 'lucide-react'
import { companiesApi } from '../../services/api'
import { Spinner } from '../../components/ui/Spinner'

/**
 * Widget en el dashboard del paciente que muestra si tiene un beneficio
 * corporativo activo (empresa cubre sus sesiones).
 */
export default function CompanyBenefitCard() {
  const [benefit, setBenefit] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    companiesApi.myBenefit()
      .then((r) => setBenefit(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !benefit?.has_benefit) return null  // no mostramos si no tiene beneficio

  const poolAvailable = (benefit.sessions_pool_total ?? 0) > 0
  const monthlyExhausted = benefit.monthly_cap !== null && benefit.sessions_used_this_month >= benefit.monthly_cap

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-wellness-600 via-brand-700 to-ink-900 p-6 sm:p-7 text-white"
    >
      <div className="absolute -top-16 -right-12 w-72 h-72 rounded-full bg-wellness-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-brand-400/20 blur-3xl pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/80 font-semibold mb-2">
          <Building2 className="w-3.5 h-3.5" /> Beneficio corporativo
        </div>
        <h3 className="text-2xl font-bold leading-tight">
          {benefit.company_name} cubre tus consultas
        </h3>
        <p className="text-sm text-white/75 mt-2 max-w-lg">
          Reservá con cualquier profesional disponible. La sesión se descuenta
          automáticamente del pool de tu empresa — sin pago de tu parte.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
          <Stat label="Sesiones usadas (total)" value={benefit.sessions_used_total} />
          {benefit.monthly_cap !== null ? (
            <Stat
              label={`Este mes (tope ${benefit.monthly_cap})`}
              value={`${benefit.sessions_used_this_month}/${benefit.monthly_cap}`}
              warning={monthlyExhausted}
            />
          ) : (
            <Stat label="Usadas este mes" value={benefit.sessions_used_this_month} />
          )}
          <Stat
            label="Pool empresa restante"
            value={benefit.sessions_pool_total ?? 0}
            warning={!poolAvailable}
          />
        </div>

        {(!poolAvailable || monthlyExhausted) && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-white bg-amber-500/30 border border-amber-300/40 px-3 py-1.5 rounded-lg">
            <AlertCircle className="w-3.5 h-3.5" />
            {!poolAvailable
              ? 'El pool de tu empresa se agotó. Si reservas, pagás con tu medio habitual.'
              : 'Alcanzaste el tope mensual. Próximas sesiones las pagás directamente.'}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function Stat({ label, value, warning = false }) {
  return (
    <div className={`rounded-2xl backdrop-blur p-3 border ${
      warning ? 'bg-amber-500/15 border-amber-300/40' : 'bg-white/10 border-white/15'
    }`}>
      <div className="text-[10px] uppercase tracking-wider text-white/70 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  )
}

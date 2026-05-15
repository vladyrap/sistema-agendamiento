import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Gift, Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { giftsApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { fadeInUp } from '../../lib/motion'
import { formatCLP } from '../../lib/format'
import { cn } from '../../lib/cn'

const STATUS_TONE = {
  pending_payment: 'bg-amber-100 text-amber-800 border-amber-200',
  active:          'bg-brand-100 text-brand-700 border-brand-200',
  redeemed:        'bg-wellness-100 text-wellness-700 border-wellness-200',
  expired:         'bg-ink-100 text-ink-600 border-ink-200',
  cancelled:       'bg-rose-100 text-rose-700 border-rose-200',
}

const STATUS_LABEL = {
  pending_payment: 'Esperando pago',
  active:          'Activa (sin canjear)',
  redeemed:        'Canjeada',
  expired:         'Expirada',
  cancelled:       'Cancelada',
}

export default function AdminGifts() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  async function load() {
    setLoading(true)
    try {
      const r = await giftsApi.listAll(filter || undefined)
      setItems(r.data)
    } catch {
      toast.error('Error cargando gift cards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return items.filter((g) => {
      if (ql) {
        const matches =
          g.code.toLowerCase().includes(ql) ||
          (g.buyer_email || '').toLowerCase().includes(ql) ||
          g.recipient_email.toLowerCase().includes(ql) ||
          g.recipient_name.toLowerCase().includes(ql)
        if (!matches) return false
      }
      if (fromDate && g.created_at) {
        if (g.created_at.slice(0, 10) < fromDate) return false
      }
      if (toDate && g.created_at) {
        if (g.created_at.slice(0, 10) > toDate) return false
      }
      return true
    })
  }, [items, q, fromDate, toDate])

  const totalActive = items.filter((g) => g.status === 'active').reduce((a, g) => a + g.amount_clp, 0)
  const totalRedeemed = items.filter((g) => g.status === 'redeemed').reduce((a, g) => a + g.amount_clp, 0)

  return (
    <div className="space-y-7">
      <motion.div {...fadeInUp}>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
          <Gift className="w-6 h-6 text-fuchsia-500" /> Gift Cards
        </h1>
        <p className="text-ink-500 text-sm mt-1">
          Códigos vendidos, canjeados y pendientes.
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total emitidas" value={items.length} />
        <StatCard label="Activas (sin canjear)" value={items.filter((g) => g.status === 'active').length} subtitle={formatCLP(totalActive)} />
        <StatCard label="Canjeadas" value={items.filter((g) => g.status === 'redeemed').length} subtitle={formatCLP(totalRedeemed)} />
        <StatCard label="Pendientes pago" value={items.filter((g) => g.status === 'pending_payment').length} />
      </div>

      {/* Filtros */}
      <Card className="p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <Input leftIcon={Search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código, email…" />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-ink-500" />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm">
            <option value="">Todos los estados</option>
            <option value="pending_payment">Esperando pago</option>
            <option value="active">Activas</option>
            <option value="redeemed">Canjeadas</option>
            <option value="expired">Expiradas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-600">
          Desde
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-10 rounded-xl border border-ink-200 bg-white px-2 text-sm" />
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-600">
          Hasta
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-10 rounded-xl border border-ink-200 bg-white px-2 text-sm" />
        </label>
        {(q || filter || fromDate || toDate) && (
          <button type="button" onClick={() => { setQ(''); setFilter(''); setFromDate(''); setToDate('') }} className="text-xs text-ink-500 hover:text-ink-900 px-2">
            Limpiar
          </button>
        )}
        <span className="text-[11px] text-ink-500 ml-auto">
          {filtered.length === items.length ? `${items.length} total` : `${filtered.length} de ${items.length}`}
        </span>
      </Card>

      {loading ? (
        <div className="py-12 flex justify-center"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gift}
            title="Sin gift cards"
            description="Cuando alguien compre, aparecerá acá."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-ink-100">
            {filtered.map((g) => (
              <li key={g.id} className="p-5 hover:bg-ink-50/60 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-bold text-ink-900">{g.code}</span>
                      <span className={cn('inline-flex items-center text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border', STATUS_TONE[g.status] || STATUS_TONE.expired)}>
                        {STATUS_LABEL[g.status] || g.status}
                      </span>
                    </div>
                    <div className="text-xs text-ink-600 mt-1.5">
                      <strong>{g.buyer_name || 'Anónimo'}</strong> ({g.buyer_email}) → <strong>{g.recipient_name}</strong> ({g.recipient_email})
                    </div>
                    {g.message && (
                      <p className="text-xs text-ink-600 mt-1 italic line-clamp-2">"{g.message}"</p>
                    )}
                    <div className="text-[11px] text-ink-500 mt-1 flex gap-3 flex-wrap">
                      {g.created_at && <span>Creada {format(parseISO(g.created_at), "d MMM yyyy", { locale: es })}</span>}
                      {g.paid_at && <span>Pagada {format(parseISO(g.paid_at), "d MMM", { locale: es })}</span>}
                      {g.redeemed_at && <span>Canjeada {format(parseISO(g.redeemed_at), "d MMM", { locale: es })}</span>}
                      {g.email_sent_at && <span>Email enviado {format(parseISO(g.email_sent_at), "d MMM", { locale: es })}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-2xl font-bold tabular-nums tracking-tight">{formatCLP(g.amount_clp)}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function StatCard({ label, value, subtitle }) {
  return (
    <Card className="p-5">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value}</div>
      {subtitle && <div className="text-[10px] text-ink-400 mt-0.5">{subtitle}</div>}
    </Card>
  )
}

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Gift, ChevronRight, Sparkles, Plus, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { giftsApi } from '../../services/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { formatCLP } from '../../lib/format'
import { cn } from '../../lib/cn'

/**
 * Widget de crédito para el dashboard del paciente.
 * - Muestra el saldo actual
 * - Permite canjear un código
 * - Link a regalar a otra persona
 */
export default function CreditCard() {
  const [credit, setCredit] = useState(null)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemOpen, setRedeemOpen] = useState(false)

  async function load() {
    try {
      const { data } = await giftsApi.myCredit()
      setCredit(data)
    } catch {
      /* silent */
    }
  }

  useEffect(() => { load() }, [])

  async function redeem(e) {
    e?.preventDefault?.()
    if (!code.trim()) return
    setRedeeming(true)
    try {
      const { data } = await giftsApi.redeem(code.trim().toUpperCase())
      toast.success(data.message || '¡Crédito acreditado!')
      setCode('')
      setRedeemOpen(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Código inválido')
    } finally {
      setRedeeming(false)
    }
  }

  const hasBalance = credit && credit.balance_clp > 0
  // Si no tiene saldo y nunca tuvo, mostrar el card promocional (regalar/canjear)
  const promotional = !hasBalance

  return (
    <Card className={cn(
      'relative overflow-hidden p-0',
      hasBalance && 'border-wellness-200 bg-gradient-to-br from-wellness-50 to-brand-50',
    )}>
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-brand-600 font-semibold mb-2">
              <Wallet className="w-3.5 h-3.5" /> Saldo de gift cards
            </div>
            {hasBalance ? (
              <>
                <div className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight text-wellness-700">
                  {formatCLP(credit.balance_clp)}
                </div>
                <p className="text-xs text-ink-500 mt-1">
                  Se usa automáticamente al reservar tu próxima cita.
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-ink-900">
                  $0
                </div>
                <p className="text-xs text-ink-500 mt-1 max-w-sm">
                  ¿Te regalaron un código de Calmar? Cánjealo acá. ¿Querés regalar bienestar? Mandá a alguien una sesión.
                </p>
              </>
            )}
          </div>
          <Link
            to="/regalar"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200 hover:bg-fuchsia-200 transition-colors"
          >
            <Gift className="w-3.5 h-3.5" /> Regalar a alguien
          </Link>
        </div>

        {!redeemOpen ? (
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => setRedeemOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" /> Canjear código
          </Button>
        ) : (
          <motion.form
            onSubmit={redeem}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-center gap-2 flex-wrap"
          >
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CALMAR-XXXX-XXXX"
              className="font-mono flex-1 min-w-[180px]"
              autoFocus
            />
            <Button size="sm" onClick={redeem} disabled={!code.trim() || redeeming}>
              <Check className="w-3.5 h-3.5" />
              {redeeming ? 'Canjeando…' : 'Canjear'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setRedeemOpen(false); setCode('') }}>
              Cancelar
            </Button>
          </motion.form>
        )}

        {hasBalance && credit.total_earned > 0 && (
          <div className="mt-4 pt-4 border-t border-wellness-100 flex items-center justify-between text-xs text-ink-600">
            <span>Total recibido: <strong className="tabular-nums">{formatCLP(credit.total_earned)}</strong></span>
            <span>Total usado: <strong className="tabular-nums">{formatCLP(credit.total_spent)}</strong></span>
          </div>
        )}
      </div>
    </Card>
  )
}

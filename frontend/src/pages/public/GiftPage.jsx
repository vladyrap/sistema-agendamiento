import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gift, Heart, ChevronRight, Check, ArrowLeft, Sparkles, Mail, User,
  Send, CreditCard, Clock,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { giftsApi } from '../../services/api'
import { Logo, LogoMark } from '../../components/ui/Logo'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { formatCLP } from '../../lib/format'
import { cn } from '../../lib/cn'

export default function GiftPage() {
  const [searchParams] = useSearchParams()
  const [packages, setPackages] = useState([])
  const [step, setStep] = useState(1)  // 1=select amount, 2=form, 3=success
  const [selectedPkg, setSelectedPkg] = useState(null)
  const [customAmount, setCustomAmount] = useState('')
  const [form, setForm] = useState({
    buyer_name: '', buyer_email: '',
    recipient_name: '', recipient_email: '',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    giftsApi.listPackages()
      .then((r) => setPackages(r.data))
      .catch(() => {})

    // Si MP nos redirigió con status=success, mostrar pantalla de éxito
    const status = searchParams.get('status')
    if (status === 'success') {
      setStep(3)
      setResult({
        amount_clp: 0,
        code: searchParams.get('code') || '',
        recipient_email: '',
        recipient_name: '',
        viaRedirect: true,
      })
    }
  }, [searchParams])

  function update(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  const amount = customAmount
    ? parseInt(customAmount, 10) || 0
    : selectedPkg?.amount_clp || 0

  async function submit() {
    if (!amount || amount < 5000) {
      toast.error('Monto mínimo $5.000 CLP')
      return
    }
    if (!form.buyer_name.trim() || !form.buyer_email.trim()) {
      toast.error('Completá tus datos')
      return
    }
    if (!form.recipient_name.trim() || !form.recipient_email.trim()) {
      toast.error('Completá los datos del destinatario')
      return
    }
    if (form.buyer_email.trim().toLowerCase() === form.recipient_email.trim().toLowerCase()) {
      toast.error('El email de quien regala no puede ser el mismo del destinatario')
      return
    }
    setSubmitting(true)
    try {
      const { data } = await giftsApi.buy({
        amount_clp: amount,
        buyer_name: form.buyer_name.trim(),
        buyer_email: form.buyer_email.trim().toLowerCase(),
        recipient_name: form.recipient_name.trim(),
        recipient_email: form.recipient_email.trim().toLowerCase(),
        message: form.message.trim() || null,
      })
      setResult({ ...data, recipient_email: form.recipient_email, recipient_name: form.recipient_name })

      // Si hay checkout_url, redirigir a MercadoPago
      if (data.checkout_url) {
        window.location.href = data.checkout_url
        return
      }
      // Si no hay MP (dev mode), pasar directo al éxito
      setStep(3)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo procesar la compra')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-wellness-50">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 border-b border-ink-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2">
            <Logo />
          </Link>
          <Link to="/login" className="text-sm text-ink-600 hover:text-ink-900 font-medium">
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 sm:py-16">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="space-y-8"
            >
              <div className="text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-ink-200 shadow-soft text-xs font-medium text-ink-700 mb-6">
                  <Gift className="w-3.5 h-3.5 text-fuchsia-500" />
                  Regalá bienestar
                </div>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tightest leading-[1.05] text-balance">
                  Cuídate con quien<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-fuchsia-500 to-wellness-500">
                    también quiere cuidarte.
                  </span>
                </h1>
                <p className="text-lg text-ink-500 mt-6 max-w-xl mx-auto leading-relaxed">
                  Regalá una sesión con un psicólogo o médico. Tu persona elegida recibe un código por email para canjear cuando quiera.
                </p>
              </div>

              {/* Packages */}
              <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {packages.map((p) => {
                  const isSelected = selectedPkg?.code === p.code && !customAmount
                  return (
                    <motion.button
                      key={p.code}
                      whileHover={{ y: -4 }}
                      onClick={() => { setSelectedPkg(p); setCustomAmount('') }}
                      className={cn(
                        'relative text-left rounded-3xl p-6 transition-all',
                        isSelected
                          ? 'bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-brand-lg'
                          : 'bg-white border border-ink-200 text-ink-900 hover:border-brand-300 hover:shadow-soft-lg',
                      )}
                    >
                      {p.highlight && (
                        <span className="absolute -top-2.5 left-6 bg-fuchsia-500 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
                          Más elegido
                        </span>
                      )}
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center mb-4',
                        isSelected ? 'bg-white/20' : 'bg-brand-50',
                      )}>
                        <Heart className={cn('w-5 h-5', isSelected ? 'text-white' : 'text-brand-600')} />
                      </div>
                      <div className={cn('text-xs uppercase tracking-wider font-semibold mb-1', isSelected ? 'text-white/80' : 'text-brand-600')}>
                        {p.name}
                      </div>
                      <div className="text-3xl font-bold tabular-nums tracking-tight">
                        {formatCLP(p.amount_clp)}
                      </div>
                      <div className={cn('text-xs mt-1', isSelected ? 'text-white/70' : 'text-ink-500')}>
                        ~{p.sessions_approx} {p.sessions_approx === 1 ? 'sesión' : 'sesiones'}
                      </div>
                      <p className={cn('text-sm mt-3 leading-snug', isSelected ? 'text-white/85' : 'text-ink-600')}>
                        {p.description}
                      </p>
                      {isSelected && (
                        <div className="flex items-center gap-1 text-xs font-semibold mt-4">
                          <Check className="w-3.5 h-3.5" /> Seleccionado
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>

              {/* Custom amount */}
              <Card className="max-w-2xl mx-auto p-5">
                <Label>O elige un monto personalizado</Label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-ink-500 font-semibold">$</span>
                  <Input
                    type="number"
                    placeholder="Ej: 50000"
                    value={customAmount}
                    min="5000"
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedPkg(null) }}
                  />
                  <span className="text-ink-500 text-xs font-semibold">CLP</span>
                </div>
                <p className="text-[11px] text-ink-500 mt-1.5">Mínimo $5.000 CLP.</p>
              </Card>

              <div className="flex justify-center">
                <Button
                  size="lg"
                  className="px-8"
                  onClick={() => setStep(2)}
                  disabled={!amount || amount < 5000}
                >
                  Continuar <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              className="max-w-2xl mx-auto"
            >
              <button onClick={() => setStep(1)} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900 font-medium mb-6">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>

              <Card className="p-6 sm:p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight">Detalles del regalo</h2>
                  <p className="text-sm text-ink-500 mt-1">
                    Monto: <strong className="text-ink-900 tabular-nums">{formatCLP(amount)}</strong>
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
                    <User className="w-3.5 h-3.5" /> Tus datos
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Tu nombre *</Label>
                      <Input value={form.buyer_name} onChange={(e) => update('buyer_name', e.target.value)} placeholder="Tu nombre" />
                    </div>
                    <div>
                      <Label>Tu email *</Label>
                      <Input type="email" value={form.buyer_email} onChange={(e) => update('buyer_email', e.target.value)} placeholder="tu@email.com" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fuchsia-600 pt-2">
                    <Heart className="w-3.5 h-3.5" /> ¿Para quién es?
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Nombre del destinatario *</Label>
                      <Input value={form.recipient_name} onChange={(e) => update('recipient_name', e.target.value)} placeholder="A quién se lo regalas" />
                    </div>
                    <div>
                      <Label>Email del destinatario *</Label>
                      <Input type="email" value={form.recipient_email} onChange={(e) => update('recipient_email', e.target.value)} placeholder="su@email.com" />
                    </div>
                  </div>

                  <div>
                    <Label>Mensaje personalizado <span className="text-ink-400 font-normal">(opcional)</span></Label>
                    <textarea
                      value={form.message}
                      onChange={(e) => update('message', e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Una palabra cálida para acompañar tu regalo..."
                      className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-ink-100">
                  <div className="flex items-start gap-3 mb-4">
                    <CreditCard className="w-5 h-5 text-brand-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-ink-600 leading-relaxed">
                      Vas a pagar con <strong>MercadoPago</strong>. Cuando se acredite el pago,
                      tu persona recibe un email con el código para canjear desde miespejo.cl.
                    </p>
                  </div>

                  <Button size="lg" className="w-full" onClick={submit} disabled={submitting}>
                    {submitting ? <><Spinner /> Procesando…</> : <><Send className="w-4 h-4" /> Pagar y enviar regalo</>}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto text-center"
            >
              <div className="relative">
                <div className="absolute inset-x-0 -top-12 flex justify-center pointer-events-none">
                  <Sparkles className="w-16 h-16 text-fuchsia-400 animate-pulse" />
                </div>
                <Card className="p-8 sm:p-12 mt-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-wellness-400 to-wellness-700 flex items-center justify-center mb-5">
                    <Check className="w-8 h-8 text-white" strokeWidth={3} />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight">¡Regalo enviado!</h2>
                  <p className="text-ink-500 mt-3 leading-relaxed">
                    {result?.recipient_name
                      ? <>Le mandamos un email a <strong className="text-ink-900">{result.recipient_email}</strong> con el código para canjear.</>
                      : <>Tu pago fue confirmado y el regalo está en camino.</>}
                  </p>
                  {result?.code && (
                    <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-ink-50 border border-ink-200 px-4 py-3 font-mono text-base tracking-wide">
                      <Gift className="w-4 h-4 text-fuchsia-500" /> {result.code}
                    </div>
                  )}
                  <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link to="/">
                      <Button variant="secondary" size="lg">Ir al inicio</Button>
                    </Link>
                    <Button size="lg" onClick={() => { setStep(1); setForm({ buyer_name:'', buyer_email:'', recipient_name:'', recipient_email:'', message:'' }); setCustomAmount(''); setSelectedPkg(null) }}>
                      Regalar otro <Gift className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="mt-16 text-center text-xs text-ink-500">
          <Link to="/" className="hover:text-ink-900">Miespejo · Calmar</Link>
        </div>
      </main>
    </div>
  )
}

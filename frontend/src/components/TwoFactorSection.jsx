import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { ShieldCheck, ShieldOff, Copy, Check, KeyRound, Smartphone } from 'lucide-react'
import { authApi } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Card } from './ui/Card'
import { Input, Label } from './ui/Input'
import { Button } from './ui/Button'

export default function TwoFactorSection() {
  const { user, refreshUser } = useAuth()
  const [phase, setPhase] = useState('idle')  // idle | setup | confirm | disable
  const [setupData, setSetupData] = useState(null)  // { secret, otpauth_url, qr_data_url }
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)

  const enabled = Boolean(user?.totp_enabled)

  async function startSetup() {
    setLoading(true)
    try {
      const r = await authApi.totpSetup()
      setSetupData(r.data)  // { secret, otpauth_url, qr_data_url }
      setPhase('setup')
      setCode('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No se pudo iniciar 2FA')
    } finally {
      setLoading(false)
    }
  }

  async function confirmSetup(e) {
    e?.preventDefault?.()
    if (code.length !== 6) return
    setLoading(true)
    try {
      const r = await authApi.totpVerify(code)
      refreshUser(r.data)
      toast.success('2FA activado ✓')
      setPhase('idle')
      setSetupData(null)
      setCode('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  async function disable2FA(e) {
    e?.preventDefault?.()
    if (code.length !== 6) return
    setLoading(true)
    try {
      const r = await authApi.totpDisable(code)
      refreshUser(r.data)
      toast.success('2FA desactivado')
      setPhase('idle')
      setCode('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Código inválido')
    } finally {
      setLoading(false)
    }
  }

  function copySecret() {
    if (!setupData?.secret) return
    navigator.clipboard.writeText(setupData.secret)
    setSecretCopied(true)
    setTimeout(() => setSecretCopied(false), 2000)
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${enabled ? 'bg-wellness-100 text-wellness-700' : 'bg-ink-100 text-ink-500'}`}>
            {enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">Verificación en dos pasos (2FA)</h3>
            <p className="text-sm text-ink-500 mt-0.5 max-w-md">
              {enabled
                ? 'Tu cuenta está protegida con un código de 6 dígitos generado por tu app autenticadora.'
                : 'Agregá una capa extra de seguridad usando Google Authenticator, Authy o similar.'}
            </p>
          </div>
        </div>

        {phase === 'idle' && (
          <div className="shrink-0">
            {enabled ? (
              <Button variant="secondary" size="sm" onClick={() => { setPhase('disable'); setCode('') }}>
                Desactivar
              </Button>
            ) : (
              <Button size="sm" onClick={startSetup} disabled={loading}>
                <Smartphone className="w-3.5 h-3.5" /> Activar 2FA
              </Button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {phase === 'setup' && setupData && (
          <motion.form
            onSubmit={confirmSetup}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 pt-6 border-t border-ink-100 grid sm:grid-cols-[auto,1fr] gap-6"
          >
            <div className="flex flex-col items-center gap-3">
              {setupData.qr_data_url ? (
                <img src={setupData.qr_data_url} alt="Código QR" className="w-44 h-44 rounded-lg border border-ink-200 bg-white p-2" />
              ) : (
                <div className="w-44 h-44 rounded-lg bg-ink-100 flex items-center justify-center text-ink-400 text-xs text-center px-3">
                  No se pudo generar el QR. Usá el secret manualmente.
                </div>
              )}
              <button
                type="button"
                onClick={copySecret}
                className="text-xs inline-flex items-center gap-1.5 text-ink-500 hover:text-ink-900 font-mono"
                title="Copiar secret"
              >
                {secretCopied ? <Check className="w-3 h-3 text-wellness-600" /> : <Copy className="w-3 h-3" />}
                {setupData.secret}
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-ink-700 space-y-2">
                <p><b>1.</b> Abrí tu app autenticadora (Google Authenticator, Authy, 1Password…).</p>
                <p><b>2.</b> Escaneá el QR de la izquierda <i>o</i> ingresá el secret manualmente.</p>
                <p><b>3.</b> Pegá acá el código de 6 dígitos que muestra la app:</p>
              </div>
              <div>
                <Label>Código de verificación</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  autoFocus
                  placeholder="123456"
                  leftIcon={KeyRound}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" size="sm" disabled={loading || code.length !== 6}>
                  {loading ? 'Verificando…' : 'Confirmar y activar'}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setPhase('idle'); setSetupData(null); setCode('') }}>
                  Cancelar
                </Button>
              </div>
            </div>
          </motion.form>
        )}

        {phase === 'disable' && (
          <motion.form
            onSubmit={disable2FA}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 pt-6 border-t border-ink-100 space-y-3"
          >
            <p className="text-sm text-ink-700">
              Para desactivar 2FA ingresá un código actual de tu app autenticadora. Esto protege contra alguien que ya tenga tu sesión abierta.
            </p>
            <div>
              <Label>Código actual</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                placeholder="123456"
                leftIcon={KeyRound}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" variant="danger" disabled={loading || code.length !== 6}>
                {loading ? 'Verificando…' : 'Desactivar 2FA'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setPhase('idle'); setCode('') }}>
                Cancelar
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </Card>
  )
}



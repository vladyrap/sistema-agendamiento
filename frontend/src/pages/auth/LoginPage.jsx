import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Mail, Lock, ArrowRight, Sparkles, ShieldCheck, HeartPulse } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { Logo } from '../../components/ui/Logo'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(form.email, form.password)
      toast.success(`Bienvenido, ${user.first_name}`)
      if (user.role === 'admin')             navigate('/admin')
      else if (user.role === 'doctor')       navigate('/doctor')
      else if (user.role === 'receptionist') navigate('/reception')
      else                                   navigate('/patient')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-white">
      {/* Left — form */}
      <div className="flex items-center justify-center px-6 py-10 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-sm"
        >
          <Logo className="mb-10" />

          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-ink-900 tracking-tight leading-tight text-balance">
              Bienvenido de vuelta
            </h1>
            <p className="text-sm text-ink-500 mt-2">
              Ingresa para gestionar tus citas y profesionales.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700 flex gap-2 items-start">
              <span className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                required
                placeholder="tu@email.com"
                leftIcon={Mail}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="mb-0">Contraseña</Label>
                <a className="text-xs text-brand-600 font-medium hover:text-brand-700">¿Olvidaste tu contraseña?</a>
              </div>
              <Input
                type="password"
                required
                placeholder="••••••••"
                leftIcon={Lock}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
              {loading ? 'Ingresando...' : <>Ingresar <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <p className="text-sm text-center text-ink-500 mt-7">
            ¿No tienes cuenta?{' '}
            <Link to="/register" className="text-brand-600 font-semibold hover:text-brand-700">
              Crear cuenta
            </Link>
          </p>

          <div className="mt-12 pt-6 border-t border-ink-100">
            <p className="text-[11px] uppercase tracking-wider text-ink-400 font-semibold mb-3">Cuentas de prueba</p>
            <div className="space-y-1.5 text-xs text-ink-500 font-mono">
              <div>paciente@ejemplo.cl · paciente123</div>
              <div>dr.garcia@clinica.cl · doctor123</div>
              <div>admin@clinica.cl · admin123</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right — visual */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 overflow-hidden">
        {/* glow blobs */}
        <div className="absolute -top-40 -right-32 w-[480px] h-[480px] rounded-full bg-brand-500/40 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 w-[420px] h-[420px] rounded-full bg-wellness-500/30 blur-3xl" />
        <div className="absolute inset-0 bg-grid-dark opacity-50" />

        <div className="relative flex flex-col justify-between p-14 text-white w-full">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Plataforma de salud y bienestar</span>
          </div>

          <div>
            <h2 className="text-5xl font-bold tracking-tightest leading-[1.05] text-balance">
              Cuidar tu salud,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-brand-200">
                a un click de distancia.
              </span>
            </h2>
            <p className="text-white/70 text-base mt-6 max-w-md leading-relaxed text-pretty">
              Agenda con profesionales verificados, recibe recordatorios automáticos y accede a tu historial cuando lo necesites.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            {[
              { icon: ShieldCheck, label: 'Profesionales verificados' },
              { icon: HeartPulse, label: 'Atención presencial y online' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm text-white/85">
                <span className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur flex items-center justify-center border border-white/15">
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

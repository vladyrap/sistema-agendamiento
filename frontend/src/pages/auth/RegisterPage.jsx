import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Mail, Lock, User, Phone, IdCard, ArrowRight, Sparkles, Heart, Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { Logo } from '../../components/ui/Logo'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', phone: '', rut: '',
  })
  const [role, setRole] = useState('patient')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register({ ...form, role })
      toast.success('Cuenta creada. Por favor inicia sesión.')
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2 bg-white">
      {/* Left — visual */}
      <div className="hidden lg:flex relative bg-gradient-to-br from-brand-800 via-brand-700 to-wellness-700 overflow-hidden order-2">
        <div className="absolute -top-40 -left-32 w-[480px] h-[480px] rounded-full bg-wellness-400/30 blur-3xl" />
        <div className="absolute -bottom-40 -right-20 w-[420px] h-[420px] rounded-full bg-brand-400/40 blur-3xl" />
        <div className="absolute inset-0 bg-grid-dark opacity-50" />
        <div className="relative flex flex-col justify-between p-14 text-white w-full">
          <div className="flex items-center gap-2 text-white/80 text-sm">
            <Sparkles className="w-4 h-4" />
            <span>Únete a la comunidad</span>
          </div>
          <div>
            <h2 className="text-5xl font-bold tracking-tightest leading-[1.05] text-balance">
              Tu bienestar<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-wellness-200">
                empieza hoy.
              </span>
            </h2>
            <p className="text-white/70 text-base mt-6 max-w-md leading-relaxed">
              Crea tu cuenta gratis y reserva con cientos de especialistas en minutos.
            </p>
          </div>
          <div />
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center px-6 py-10 lg:py-16 order-1">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Logo className="mb-10" />
          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-ink-900 tracking-tight leading-tight">
              Crear cuenta
            </h1>
            <p className="text-sm text-ink-500 mt-2">Solo te toma un minuto.</p>
          </div>

          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selector de rol: paciente o tutor */}
            <div>
              <Label>Tipo de cuenta</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setRole('patient')}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    role === 'patient'
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>Paciente</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('tutor')}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    role === 'tutor'
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Tutor</span>
                </button>
              </div>
              <p className="text-[11px] text-ink-500 mt-1.5">
                {role === 'patient'
                  ? 'Cuenta para reservar y gestionar tus consultas.'
                  : 'Para padres/familiares que cuidan a un paciente. Necesitás que el paciente te agregue como tutor con tu email después.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input required leftIcon={User} value={form.first_name} onChange={set('first_name')} />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input required value={form.last_name} onChange={set('last_name')} />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" required leftIcon={Mail} value={form.email} onChange={set('email')} />
            </div>
            <div>
              <Label>Contraseña</Label>
              <Input type="password" required minLength={6} leftIcon={Lock} value={form.password} onChange={set('password')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>RUT</Label>
                <Input placeholder="12345678-9" leftIcon={IdCard} value={form.rut} onChange={set('rut')} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input placeholder="+56 9..." leftIcon={Phone} value={form.phone} onChange={set('phone')} />
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full mt-2" disabled={loading}>
              {loading ? 'Creando...' : <>Crear cuenta <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </form>

          <p className="text-sm text-center text-ink-500 mt-7">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-brand-600 font-semibold hover:text-brand-700">
              Inicia sesión
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

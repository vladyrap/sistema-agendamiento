import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, Calendar, Bell, Stethoscope, Brain, HeartPulse, Baby, Eye, Bone,
  ShieldCheck, Sparkles, ArrowRight, Star, Check, Video,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Logo } from '../../components/ui/Logo'
import { Avatar } from '../../components/ui/Avatar'

const specialties = [
  { name: 'Medicina General', icon: Stethoscope, hue: 'brand' },
  { name: 'Psicología', icon: Brain, hue: 'wellness' },
  { name: 'Cardiología', icon: HeartPulse, hue: 'rose' },
  { name: 'Pediatría', icon: Baby, hue: 'amber' },
  { name: 'Oftalmología', icon: Eye, hue: 'sky' },
  { name: 'Traumatología', icon: Bone, hue: 'violet' },
]

const hueClasses = {
  brand:    'bg-brand-50 text-brand-600 border-brand-100',
  wellness: 'bg-wellness-50 text-wellness-600 border-wellness-100',
  rose:     'bg-rose-50 text-rose-600 border-rose-100',
  amber:    'bg-amber-50 text-amber-600 border-amber-100',
  sky:      'bg-sky-50 text-sky-600 border-sky-100',
  violet:   'bg-violet-50 text-violet-600 border-violet-100',
}

const features = [
  { icon: Search, title: 'Encuentra al ideal', desc: 'Busca por especialidad, modalidad o ubicación con un buscador inteligente.' },
  { icon: Calendar, title: 'Reserva en 1 minuto', desc: 'Disponibilidad en tiempo real, sin llamadas ni esperas.' },
  { icon: Bell, title: 'Recordatorios sin estrés', desc: 'Te avisamos por email para que nunca pierdas una cita.' },
  { icon: Video, title: 'Online o presencial', desc: 'Atención por videollamada o en consulta, tú eliges.' },
]

const testimonials = [
  { name: 'Camila Reyes', rol: 'Paciente', text: 'Pude agendar una psicóloga el mismo día. La experiencia fue impecable, súper humana.' },
  { name: 'Diego Fernández', rol: 'Paciente', text: 'Reservar con mi médico nunca había sido tan rápido. Y el recordatorio salvó mi semana.' },
  { name: 'Valentina Soto', rol: 'Paciente', text: 'La interfaz es hermosa y todo está donde lo busco. Se nota el cuidado en cada detalle.' },
]

export default function LandingPage() {
  return (
    <div className="bg-white text-ink-900">
      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/75 border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-600 font-medium">
            <a href="#especialidades" className="hover:text-ink-900">Especialidades</a>
            <a href="#como-funciona" className="hover:text-ink-900">Cómo funciona</a>
            <a href="#testimonios" className="hover:text-ink-900">Testimonios</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Ingresar</Button>
            </Link>
            <Link to="/register" className="hidden sm:block">
              <Button size="sm">Crear cuenta</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Soft gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50/60 via-white to-white" />
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-brand-100/40 blur-3xl pointer-events-none" />
        <div className="absolute top-40 left-10 w-72 h-72 rounded-full bg-wellness-100/40 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-ink-200 shadow-soft text-xs font-medium text-ink-700 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-wellness-500 animate-pulse-soft" />
              Salud & bienestar emocional · más de 200 profesionales
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tightest leading-[1.02] text-balance">
              Cuídate con quien<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 via-brand-500 to-wellness-500">
                realmente sabe escuchar.
              </span>
            </h1>
            <p className="text-lg md:text-xl text-ink-500 mt-7 max-w-2xl mx-auto leading-relaxed text-pretty">
              Reserva con médicos y psicólogos verificados en minutos.
              Presencial o por videollamada, sin esperas, sin papeleo.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
              <Link to="/register">
                <Button size="lg" className="w-full sm:w-auto px-8">
                  Reservar mi primera cita <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto px-8">
                  Ver cómo funciona
                </Button>
              </a>
            </div>

            <div className="mt-10 flex items-center justify-center gap-6 text-xs text-ink-500">
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-wellness-600" /> Sin costo de registro</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-wellness-600" /> Cancelación gratuita</div>
              <div className="hidden sm:flex items-center gap-1.5"><Check className="w-4 h-4 text-wellness-600" /> Datos encriptados</div>
            </div>
          </motion.div>

          {/* Floating preview card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative max-w-4xl mx-auto mt-20"
          >
            <div className="absolute -inset-6 bg-gradient-to-r from-brand-200/40 via-transparent to-wellness-200/40 blur-3xl pointer-events-none" />
            <div className="relative rounded-3xl bg-white border border-ink-200 shadow-soft-lg p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'María García',     specialty: 'Medicina General', when: 'Hoy · 14:30',  status: 'Confirmada' },
                { name: 'Andrés Pizarro',   specialty: 'Psicología',       when: 'Mañana · 10:00', status: 'Online' },
                { name: 'Constanza López',  specialty: 'Cardiología',      when: 'Vie · 16:00',  status: 'Presencial' },
              ].map((c, i) => (
                <div key={i} className="rounded-2xl border border-ink-100 p-5 bg-gradient-to-br from-white to-ink-50/40">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} size="md" />
                    <div>
                      <div className="text-sm font-semibold text-ink-900">Dr(a). {c.name}</div>
                      <div className="text-xs text-brand-600 font-medium">{c.specialty}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-1.5 text-xs text-ink-600">
                      <Calendar className="w-3.5 h-3.5" /> {c.when}
                    </div>
                    <span className="text-[10px] uppercase tracking-wide font-bold text-wellness-700 bg-wellness-50 border border-wellness-100 px-2 py-0.5 rounded-full">
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── ESPECIALIDADES ─────────────────────────────────────────────── */}
      <section id="especialidades" className="py-24 bg-ink-50/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3">Especialidades</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
              Cubrimos lo que necesitas, cuando lo necesitas.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {specialties.map((s) => (
              <motion.div
                key={s.name}
                whileHover={{ y: -4 }}
                className="rounded-2xl bg-white border border-ink-200 p-5 text-center cursor-pointer transition-shadow hover:shadow-soft"
              >
                <div className={`w-12 h-12 mx-auto rounded-xl border flex items-center justify-center ${hueClasses[s.hue]}`}>
                  <s.icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <div className="mt-3 text-sm font-semibold text-ink-800">{s.name}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ──────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3">Cómo funciona</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
              Diseñado para que reservar sea casi mágico.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-2xl bg-white border border-ink-200 p-6 hover:shadow-soft transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-brand-sm">
                  <f.icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <h3 className="text-base font-semibold mt-5 tracking-tight">{f.title}</h3>
                <p className="text-sm text-ink-500 mt-1.5 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ────────────────────────────────────────────────── */}
      <section id="testimonios" className="py-24 bg-gradient-to-b from-white via-brand-50/30 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-3">Testimonios</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
              Personas que volvieron a sentirse bien.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl bg-white border border-ink-200 p-6 shadow-soft">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[15px] text-ink-700 mt-4 leading-relaxed text-pretty">"{t.text}"</p>
                <div className="flex items-center gap-3 mt-5 pt-5 border-t border-ink-100">
                  <Avatar name={t.name} size="sm" />
                  <div>
                    <div className="text-sm font-semibold text-ink-900">{t.name}</div>
                    <div className="text-xs text-ink-500">{t.rol}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ──────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 p-12 md:p-16 text-center shadow-soft-lg">
            <div className="absolute -top-32 -right-20 w-96 h-96 rounded-full bg-brand-400/30 blur-3xl" />
            <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-wellness-400/20 blur-3xl" />
            <div className="absolute inset-0 bg-grid-dark opacity-40" />

            <div className="relative">
              <Sparkles className="w-8 h-8 text-white/80 mx-auto" />
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tightest mt-5 leading-tight text-balance">
                Empieza a cuidarte en serio.
              </h2>
              <p className="text-white/70 mt-5 max-w-lg mx-auto text-pretty">
                Crea tu cuenta gratis y reserva con quien necesites en un solo lugar.
              </p>
              <Link to="/register" className="inline-block mt-8">
                <Button variant="dark" size="lg" className="bg-white text-ink-900 hover:bg-ink-50 px-8">
                  Crear cuenta gratis <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <div className="mt-6 inline-flex items-center gap-2 text-xs text-white/60">
                <ShieldCheck className="w-4 h-4" /> Tus datos están encriptados y protegidos
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-ink-100 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-ink-500">© {new Date().getFullYear()} Calmar · Plataforma de salud digital</p>
        </div>
      </footer>
    </div>
  )
}

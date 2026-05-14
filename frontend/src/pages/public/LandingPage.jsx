import React, { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  Search, Calendar, Bell, Stethoscope, Brain, HeartPulse, Baby, Eye, Bone,
  ShieldCheck, Sparkles, ArrowRight, Star, Check, Video,
} from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Logo, LogoMark } from '../../components/ui/Logo'
import { Avatar } from '../../components/ui/Avatar'

import ParticleField from '../../components/landing/ParticleField'
import RevealText from '../../components/landing/RevealText'
import GradientBorderCard from '../../components/landing/GradientBorderCard'
import ChromaticHeading from '../../components/landing/ChromaticHeading'

const specialties = [
  { name: 'Medicina General', icon: Stethoscope, accent: 'from-brand-400 to-brand-600' },
  { name: 'Psicología',       icon: Brain,       accent: 'from-fuchsia-400 to-fuchsia-600' },
  { name: 'Cardiología',      icon: HeartPulse,  accent: 'from-rose-400 to-rose-600' },
  { name: 'Pediatría',        icon: Baby,        accent: 'from-amber-400 to-amber-600' },
  { name: 'Oftalmología',     icon: Eye,         accent: 'from-cyan-400 to-cyan-600' },
  { name: 'Traumatología',    icon: Bone,        accent: 'from-violet-400 to-violet-600' },
]

const features = [
  { icon: Search,   title: 'Encuentra al ideal',         desc: 'Busca por especialidad, modalidad o ubicación con un buscador inteligente.' },
  { icon: Calendar, title: 'Reserva en 1 minuto',        desc: 'Disponibilidad en tiempo real, sin llamadas ni esperas.' },
  { icon: Bell,     title: 'Recordatorios sin estrés',   desc: 'Te avisamos por email para que nunca pierdas una cita.' },
  { icon: Video,    title: 'Online o presencial',        desc: 'Atención por videollamada o en consulta — tú decides.' },
]

const testimonials = [
  { name: 'Camila Reyes',     rol: 'Paciente', text: 'Pude agendar una psicóloga el mismo día. La experiencia fue impecable, súper humana.' },
  { name: 'Diego Fernández',  rol: 'Paciente', text: 'Reservar con mi médico nunca había sido tan rápido. Y el recordatorio salvó mi semana.' },
  { name: 'Valentina Soto',   rol: 'Paciente', text: 'La interfaz es hermosa y todo está donde lo busco. Se nota el cuidado en cada detalle.' },
]


/**
 * Spotlight que sigue al mouse — manipulación DOM directa para evitar
 * re-renders de React en cada mousemove.
 */
function useMouseSpotlight() {
  const ref = useRef(null)
  useEffect(() => {
    let raf = 0
    let nextX = 0
    let nextY = 0
    const apply = () => {
      if (ref.current) {
        ref.current.style.transform = `translate3d(${nextX - 300}px, ${nextY - 300}px, 0)`
      }
      raf = 0
    }
    const handler = (e) => {
      nextX = e.clientX
      nextY = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handler)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
  return ref
}


export default function LandingPage() {
  const { scrollY } = useScroll()
  const heroParallax = useTransform(scrollY, [0, 600], [0, -120])
  const heroOpacity  = useTransform(scrollY, [0, 600], [1, 0.3])

  const spotlightRef = useMouseSpotlight()

  return (
    <div className="relative bg-ink-950 text-white overflow-x-hidden selection:bg-fuchsia-500/30 selection:text-white">
      {/* ── Capa global: gradientes de fondo + grid sutil ───────────────── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950 via-[#0a0a1f] to-ink-950" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />
        {/* Spotlight que sigue al mouse — actualizado vía ref, no React state */}
        <div
          ref={spotlightRef}
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full opacity-40 will-change-transform"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 70%)',
            filter: 'blur(60px)',
            transform: 'translate3d(-9999px, -9999px, 0)',
          }}
        />
        {/* Orbes flotantes */}
        <div className="absolute top-[10%] left-[8%] w-72 h-72 rounded-full bg-fuchsia-600/15 blur-[100px] animate-float-slow" />
        <div
          className="absolute top-[40%] right-[12%] w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] animate-float-slow"
          style={{ animationDelay: '2s' }}
        />
        <div
          className="absolute bottom-[10%] left-[40%] w-80 h-80 rounded-full bg-brand-500/15 blur-[110px] animate-float-slow"
          style={{ animationDelay: '4s' }}
        />
      </div>

      {/* Partículas — solo en el hero, para no saturar */}
      <ParticleField className="fixed inset-0 z-0 h-screen w-screen" maxParticles={90} />

      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-ink-950/40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size={32} />
            <span className="text-[15px] font-bold tracking-tight text-white">
              Calmar<span className="text-fuchsia-400">.</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/60 font-medium">
            <a href="#especialidades" className="hover:text-white transition-colors">Especialidades</a>
            <a href="#como-funciona"  className="hover:text-white transition-colors">Cómo funciona</a>
            <a href="#testimonios"    className="hover:text-white transition-colors">Testimonios</a>
            <Link to="/regalar" className="hover:text-white transition-colors inline-flex items-center gap-1">
              🎁 Regalar
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10">Ingresar</Button>
            </Link>
            <Link to="/register" className="hidden sm:block">
              <Button
                size="sm"
                className="bg-white text-ink-900 hover:bg-white/90 shadow-lg shadow-white/10"
              >
                Crear cuenta
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10">
        <motion.div
          style={{ y: heroParallax, opacity: heroOpacity }}
          className="max-w-7xl mx-auto px-6 pt-24 pb-24 lg:pt-32 lg:pb-32"
        >
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur border border-white/10 text-xs font-medium text-white/80 mb-9"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse-soft" />
              Salud & bienestar emocional · más de 200 profesionales
            </motion.div>

            <h1 className="text-5xl md:text-6xl lg:text-[5.5rem] font-bold tracking-tightest leading-[0.98] text-balance">
              <RevealText className="block text-white/90">
                Cuídate con quien
              </RevealText>
              <ChromaticHeading
                as="span"
                intensity="normal"
                className="block mt-2 text-transparent bg-clip-text bg-gradient-to-r from-brand-300 via-fuchsia-300 to-cyan-300"
              >
                <RevealText delay={0.25}>realmente sabe escuchar.</RevealText>
              </ChromaticHeading>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.1 }}
              className="text-lg md:text-xl text-white/55 mt-8 max-w-2xl mx-auto leading-relaxed text-pretty"
            >
              Reserva con médicos y psicólogos verificados en minutos.
              Presencial o por videollamada, sin esperas, sin papeleo.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10"
            >
              <Link to="/register">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 hover:from-brand-400 hover:to-brand-700 shadow-[0_0_40px_-8px_rgba(99,102,241,0.6)]"
                >
                  Reservar mi primera cita <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#como-funciona">
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full sm:w-auto px-8 text-white/80 hover:text-white border border-white/15 bg-white/5 hover:bg-white/10 backdrop-blur"
                >
                  Ver cómo funciona
                </Button>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.5 }}
              className="mt-10 flex items-center justify-center gap-6 text-xs text-white/40"
            >
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-fuchsia-400" /> Sin costo de registro</div>
              <div className="flex items-center gap-1.5"><Check className="w-4 h-4 text-cyan-400" /> Cancelación gratuita</div>
              <div className="hidden sm:flex items-center gap-1.5"><Check className="w-4 h-4 text-brand-400" /> Datos encriptados</div>
            </motion.div>
          </div>

          {/* Preview cards flotantes */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.7 }}
            className="relative max-w-5xl mx-auto mt-24"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                { name: 'María García',    specialty: 'Medicina General', when: 'Hoy · 14:30',    status: 'Confirmada', tint: 'brand' },
                { name: 'Andrés Pizarro',  specialty: 'Psicología',       when: 'Mañana · 10:00', status: 'Online',     tint: 'fuchsia' },
                { name: 'Constanza López', specialty: 'Cardiología',      when: 'Vie · 16:00',    status: 'Presencial', tint: 'cyan' },
              ].map((c, i) => (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.9 + i * 0.1 }}
                  whileHover={{ y: -6 }}
                >
                  <GradientBorderCard speed={i === 1 ? 'normal' : 'slow'}>
                    <div className="p-5">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size="md" />
                        <div>
                          <div className="text-sm font-semibold text-white">Dr(a). {c.name}</div>
                          <div className="text-xs text-fuchsia-300 font-medium">{c.specialty}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-1.5 text-xs text-white/50">
                          <Calendar className="w-3.5 h-3.5" /> {c.when}
                        </div>
                        <span className="text-[10px] uppercase tracking-wide font-bold text-white/90 bg-white/10 border border-white/15 px-2 py-0.5 rounded-full">
                          {c.status}
                        </span>
                      </div>
                    </div>
                  </GradientBorderCard>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── ESPECIALIDADES ──────────────────────────────────────────────── */}
      <section id="especialidades" className="relative z-10 py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-semibold text-fuchsia-300 uppercase tracking-[0.2em] mb-4">
              Especialidades
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-balance text-white">
              <RevealText>Cubrimos lo que necesitas,</RevealText>
              <br />
              <RevealText className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-cyan-300" delay={0.2}>
                cuando lo necesitas.
              </RevealText>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {specialties.map((s, i) => (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                whileHover={{ y: -4 }}
                className="group relative rounded-2xl bg-white/[0.03] border border-white/5 p-5 text-center backdrop-blur-sm hover:border-white/15 hover:bg-white/[0.06] transition-all duration-300 cursor-pointer overflow-hidden"
              >
                <div
                  aria-hidden
                  className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${s.accent}/10`}
                />
                <div
                  className={`relative w-12 h-12 mx-auto rounded-xl flex items-center justify-center bg-gradient-to-br ${s.accent} shadow-lg`}
                >
                  <s.icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <div className="relative mt-3 text-sm font-semibold text-white/90">{s.name}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ───────────────────────────────────────────────── */}
      <section id="como-funciona" className="relative z-10 py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-semibold text-cyan-300 uppercase tracking-[0.2em] mb-4">
              Cómo funciona
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-balance text-white">
              <RevealText>Diseñado para que reservar sea</RevealText>
              <br />
              <RevealText className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-brand-300 to-fuchsia-300" delay={0.2}>
                casi mágico.
              </RevealText>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
              >
                <GradientBorderCard speed={i % 2 === 0 ? 'slow' : 'normal'} className="h-full">
                  <div className="p-6 h-full">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-fuchsia-600 flex items-center justify-center shadow-[0_8px_30px_-8px_rgba(168,85,247,0.6)]">
                      <f.icon className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <h3 className="text-base font-semibold mt-5 tracking-tight text-white">{f.title}</h3>
                    <p className="text-sm text-white/55 mt-2 leading-relaxed">{f.desc}</p>
                  </div>
                </GradientBorderCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIOS ─────────────────────────────────────────────────── */}
      <section id="testimonios" className="relative z-10 py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs font-semibold text-brand-300 uppercase tracking-[0.2em] mb-4">
              Testimonios
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-balance text-white">
              <RevealText>Personas que volvieron a</RevealText>{' '}
              <RevealText className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-brand-300" delay={0.15}>
                sentirse bien.
              </RevealText>
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-3xl bg-white/[0.03] border border-white/10 p-6 backdrop-blur-sm hover:bg-white/[0.05] transition-colors"
              >
                <div className="flex gap-1">
                  {[...Array(5)].map((_, k) => (
                    <Star key={k} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-[15px] text-white/80 mt-4 leading-relaxed text-pretty">"{t.text}"</p>
                <div className="flex items-center gap-3 mt-5 pt-5 border-t border-white/10">
                  <Avatar name={t.name} size="sm" />
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/40">{t.rol}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────────────────── */}
      <section className="relative z-10 py-28">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative overflow-hidden rounded-4xl p-12 md:p-16 text-center">
            {/* Borde + bg */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-4xl bg-gradient-to-br from-brand-800/40 via-fuchsia-900/30 to-cyan-900/30 backdrop-blur-xl"
            />
            <div
              aria-hidden
              className="absolute inset-0 rounded-4xl ring-1 ring-white/10"
            />
            <div
              aria-hidden
              className="absolute -top-32 -right-20 w-96 h-96 rounded-full bg-fuchsia-500/30 blur-3xl"
            />
            <div
              aria-hidden
              className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl"
            />

            <div className="relative">
              <Sparkles className="w-8 h-8 text-white/80 mx-auto" />
              <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tightest mt-5 leading-tight text-balance">
                <RevealText>Empieza a</RevealText>{' '}
                <ChromaticHeading
                  as="span"
                  intensity="subtle"
                  className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-300 to-cyan-300"
                >
                  <RevealText delay={0.2}>cuidarte en serio.</RevealText>
                </ChromaticHeading>
              </h2>
              <p className="text-white/60 mt-5 max-w-lg mx-auto text-pretty">
                Crea tu cuenta gratis y reserva con quien necesites en un solo lugar.
              </p>
              <Link to="/register" className="inline-block mt-8">
                <Button
                  size="lg"
                  className="px-8 bg-white text-ink-900 hover:bg-white/90 shadow-[0_0_60px_-10px_rgba(255,255,255,0.5)]"
                >
                  Crear cuenta gratis <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <div className="mt-6 inline-flex items-center gap-2 text-xs text-white/50">
                <ShieldCheck className="w-4 h-4" /> Tus datos están encriptados y protegidos
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 py-10 mt-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <LogoMark size={28} />
            <span className="text-sm font-bold tracking-tight text-white/90">
              Calmar<span className="text-fuchsia-400">.</span>
            </span>
          </div>
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} Calmar · Plataforma de salud digital
          </p>
        </div>
      </footer>
    </div>
  )
}

import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ShieldCheck, FileText, ClipboardCheck, Users, ArrowRight, AlertTriangle, Brain, BarChart3, Lock, Sparkles,
} from 'lucide-react'
import { Logo, LogoMark } from '../../components/ui/Logo'
import { Button } from '../../components/ui/Button'
import { useSiteSettings, buildWhatsappUrl } from '../../context/SiteSettingsContext'

const MSG_DIAGNOSTICO = 'Hola Calmar 👋 Quiero solicitar un diagnóstico Ley Karin para mi empresa.'
const MSG_CONSULTOR   = 'Hola Calmar 👋 Quiero hablar con un/a consultor/a sobre la Ley Karin.'

const REQUISITOS = [
  { icon: FileText,        title: 'Protocolo escrito',        desc: 'Protocolo de prevención de acoso laboral, sexual y violencia, formalizado y comunicado.' },
  { icon: ClipboardCheck,  title: 'Evaluación de riesgos',    desc: 'Aplicación obligatoria del cuestionario SUSESO/ISTAS-21 a tus trabajadores.' },
  { icon: AlertTriangle,   title: 'Procedimiento de denuncia', desc: 'Plazos legales: 3 días para medidas de resguardo, 30 días para investigación.' },
  { icon: Users,           title: 'Capacitación',              desc: 'Trabajadores y jefaturas formados en prevención y manejo de denuncias.' },
  { icon: Brain,           title: 'Apoyo a víctimas',          desc: 'Acompañamiento psicológico para personas afectadas — Calmar lo provee.' },
  { icon: BarChart3,       title: 'Plan de mejora',            desc: 'Acciones concretas basadas en resultados, con seguimiento periódico.' },
]

const PASOS = [
  { n: '01', title: 'Diagnóstico inicial',     desc: 'Un/a psicólogo/a organizacional Calmar levanta el contexto de tu empresa.' },
  { n: '02', title: 'Envío del cuestionario',  desc: 'Compartes un link anónimo con tu equipo. SUSESO/ISTAS-21, 5 minutos.' },
  { n: '03', title: 'Reporte por dimensión',   desc: '5 dimensiones: exigencias, control, apoyo, compensaciones, doble presencia.' },
  { n: '04', title: 'Plan de acción',          desc: 'Recomendaciones específicas + derivación a terapia individual si se detectan riesgos.' },
]

export default function LeyKarinLanding() {
  const { settings } = useSiteSettings()
  const waDiagnostico = buildWhatsappUrl(settings.whatsapp_number, MSG_DIAGNOSTICO)
  const waConsultor   = buildWhatsappUrl(settings.whatsapp_number, MSG_CONSULTOR)
  const emailHref = `mailto:${settings.contact_email || 'hola@miespejo.cl'}?subject=Consulta%20Ley%20Karin`

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 via-white to-white">
      {/* Header */}
      <header className="border-b border-ink-100 bg-white/90 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2">
            <LogoMark size={28} />
            <span className="text-[15px] font-bold tracking-tight text-ink-900">Calmar<span className="text-brand-600">.</span></span>
          </Link>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-ink-600">
            <Link to="/" className="hover:text-ink-900">Inicio</Link>
            <Link to="/login" className="hover:text-ink-900">Ingresar</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" /> Ley 21.643 · Vigente desde agosto 2024
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tightest mt-5 text-ink-900">
            Cumple con la <span className="text-brand-600">Ley Karin</span> sin papeleo, sin enredos.
          </h1>
          <p className="text-base sm:text-lg text-ink-600 mt-5 leading-relaxed">
            Toda empresa chilena debe evaluar el riesgo psicosocial de sus trabajadores. Te ayudamos
            a hacerlo en menos de una semana con un/a psicólogo/a organizacional dedicado/a, el
            cuestionario oficial SUSESO/ISTAS-21 y un plan de acción concreto.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
            <a href={waDiagnostico || emailHref} target="_blank" rel="noopener noreferrer">
              <Button size="lg">
                {waDiagnostico ? 'Solicitar por WhatsApp' : 'Solicitar diagnóstico'} <ArrowRight className="w-4 h-4" />
              </Button>
            </a>
            <Link to="/login"><Button variant="ghost" size="lg">Ya soy cliente</Button></Link>
          </div>
          <p className="text-xs text-ink-500 mt-4">
            <Lock className="inline w-3 h-3 mr-1" /> Las respuestas de los trabajadores son anónimas.
          </p>
        </motion.div>
      </section>

      {/* Qué exige la ley */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">Qué exige la Ley Karin</h2>
          <p className="text-sm text-ink-600 mt-2">
            Toda empresa (privada o pública), sin importar tamaño, debe tener implementado:
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REQUISITOS.map((r) => (
            <div key={r.title} className="rounded-2xl border border-ink-100 p-5 bg-white">
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                <r.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-ink-900">{r.title}</h3>
              <p className="text-xs text-ink-600 mt-1.5 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Proceso Calmar */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <div className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-800 to-ink-900 text-white p-8 sm:p-12 relative overflow-hidden">
          <div className="absolute -top-20 -right-12 w-72 h-72 rounded-full bg-brand-400/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-wellness-400/20 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-white/70">
              <Sparkles className="w-3.5 h-3.5" /> Cómo lo hacemos
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mt-2">4 pasos, una semana</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
              {PASOS.map((p) => (
                <div key={p.n} className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-5">
                  <div className="text-[10px] font-bold tracking-widest text-white/60">{p.n}</div>
                  <div className="text-sm font-bold mt-1.5">{p.title}</div>
                  <p className="text-xs text-white/70 mt-1.5 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-ink-900 tracking-tight">¿Listo para cumplir?</h2>
        <p className="text-sm text-ink-600 mt-3 max-w-xl mx-auto">
          Tarifa única por trabajador para el diagnóstico inicial. Sin contratos largos.
          Conversamos contigo en menos de 24 horas hábiles.
        </p>
        <div className="flex items-center justify-center gap-3 mt-7 flex-wrap">
          <a href={waConsultor || emailHref} target="_blank" rel="noopener noreferrer">
            <Button size="lg">
              {waConsultor ? 'Hablar por WhatsApp' : 'Contactar consultor'} <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
        <p className="text-[11px] text-ink-400 mt-6">
          Calmar es una plataforma de psicología clínica y organizacional con psicólogos verificados.
          Cumplimos con Ley 19.628 (datos personales) y Ley 20.584 (derechos del paciente).
        </p>
      </section>

      <footer className="border-t border-ink-100 py-8 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} Calmar · miespejo.cl
      </footer>
    </div>
  )
}

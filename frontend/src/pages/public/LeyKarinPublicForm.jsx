import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, CheckCircle2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { leyKarinApi } from '../../services/api'
import { LogoMark } from '../../components/ui/Logo'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'

const AGE_OPTIONS = [
  { v: 'menos_30',  label: 'Menos de 30 años' },
  { v: '30_49',     label: '30 a 49 años' },
  { v: '50_mas',    label: '50 años o más' },
  { v: 'ns_nc',     label: 'Prefiero no decir' },
]
const TENURE_OPTIONS = [
  { v: 'menos_1',   label: 'Menos de 1 año' },
  { v: '1_5',       label: 'Entre 1 y 5 años' },
  { v: 'mas_5',     label: 'Más de 5 años' },
  { v: 'ns_nc',     label: 'Prefiero no decir' },
]
const GENDER_OPTIONS = [
  { v: 'f',         label: 'Femenino' },
  { v: 'm',         label: 'Masculino' },
  { v: 'nb',        label: 'No binario / otro' },
  { v: 'ns_nc',     label: 'Prefiero no decir' },
]

export default function LeyKarinPublicForm() {
  const { token } = useParams()
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const [step, setStep] = useState(0)  // 0 = intro/demo, 1..N = dimensiones, N+1 = enviar
  const [answers, setAnswers] = useState({})
  const [demo, setDemo] = useState({ age: 'ns_nc', tenure: 'ns_nc', gender: 'ns_nc', department: '' })

  useEffect(() => {
    leyKarinApi.publicForm(token)
      .then((r) => setForm(r.data))
      .catch((err) => {
        if (err.response?.status === 410) setErrorMsg('Esta evaluación ya no está activa.')
        else if (err.response?.status === 404) setErrorMsg('Enlace no válido o expirado.')
        else setErrorMsg('No pudimos cargar el cuestionario. Intenta de nuevo más tarde.')
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50">
      <Spinner size="lg" />
    </div>
  )

  if (errorMsg) return (
    <CenteredCard>
      <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h2 className="text-lg font-bold text-ink-900 mt-4 text-center">No se pudo abrir</h2>
      <p className="text-sm text-ink-600 mt-2 text-center">{errorMsg}</p>
    </CenteredCard>
  )

  if (submitted) return (
    <CenteredCard>
      <div className="w-12 h-12 rounded-2xl bg-wellness-100 text-wellness-700 flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-6 h-6" />
      </div>
      <h2 className="text-lg font-bold text-ink-900 mt-4 text-center">¡Gracias por participar!</h2>
      <p className="text-sm text-ink-600 mt-2 text-center max-w-md">
        Tu respuesta quedó registrada de forma <strong>anónima</strong>. No se guardó tu nombre,
        email ni ningún dato que pueda identificarte. Los resultados se entregan agregados al
        equipo de prevención.
      </p>
      <p className="text-xs text-ink-500 mt-6 text-center">
        Si en algún momento sientes que necesitas apoyo psicológico, puedes acceder a una sesión
        directamente en <Link to="/" className="text-brand-600 font-semibold">miespejo.cl</Link>.
      </p>
    </CenteredCard>
  )

  if (!form) return null

  const dimensions = form.dimensions || []
  const totalSteps = 1 + dimensions.length  // intro + 1 paso por dimensión

  const answeredCount = Object.keys(answers).length
  const totalQuestions = (form.items || []).length
  const progress = Math.round((answeredCount / Math.max(totalQuestions, 1)) * 100)

  function setAnswer(itemCode, value) {
    setAnswers((prev) => ({ ...prev, [itemCode]: value }))
  }

  async function handleSubmit() {
    if (answeredCount < 10) {
      toast.error(`Por favor responde al menos 10 preguntas. Llevas ${answeredCount}.`)
      return
    }
    setSubmitting(true)
    try {
      await leyKarinApi.publicSubmit(token, {
        answers,
        meta_age_range: demo.age !== 'ns_nc' ? demo.age : null,
        meta_tenure: demo.tenure !== 'ns_nc' ? demo.tenure : null,
        meta_gender: demo.gender !== 'ns_nc' ? demo.gender : null,
        meta_department: demo.department.trim() || null,
      })
      setSubmitted(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'No pudimos guardar tu respuesta. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/40 via-ink-50 to-white">
      <header className="bg-white border-b border-ink-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="inline-flex items-center gap-2">
            <LogoMark size={24} />
            <span className="text-[13px] font-bold text-ink-900">Calmar<span className="text-brand-600">.</span></span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
            <Lock className="w-3 h-3" /> Anónimo
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-ink-100">
          <motion.div
            className="h-1 bg-brand-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 sm:py-12">
        <div className="text-center mb-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">
            Evaluación Ley Karin · {form.company_name}
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-ink-900 mt-1.5">{form.title}</h1>
        </div>

        {step === 0 && (
          <IntroAndDemographics
            demo={demo}
            setDemo={setDemo}
            onContinue={() => setStep(1)}
          />
        )}

        {step >= 1 && step <= dimensions.length && (
          <DimensionStep
            stepNumber={step}
            totalDims={dimensions.length}
            dim={dimensions[step - 1]}
            items={(form.items || []).filter((it) => it.dimension === dimensions[step - 1].code)}
            likert={form.likert}
            answers={answers}
            setAnswer={setAnswer}
            onBack={() => setStep(step - 1)}
            onContinue={() => setStep(step + 1)}
          />
        )}

        {step === totalSteps && (
          <ReviewAndSubmit
            answeredCount={answeredCount}
            totalQuestions={totalQuestions}
            onBack={() => setStep(step - 1)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}

        <p className="text-[11px] text-ink-400 mt-10 text-center max-w-md mx-auto leading-relaxed">
          Esta evaluación se realiza en cumplimiento de la Ley 21.643 (Ley Karin) y la Norma Técnica
          MINSAL. Tus respuestas son anónimas y se procesan en agregado.
        </p>
      </main>
    </div>
  )
}

function CenteredCard({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 p-5">
      <div className="bg-white rounded-3xl shadow-soft-lg p-8 max-w-md w-full flex flex-col items-center">
        {children}
      </div>
    </div>
  )
}

function IntroAndDemographics({ demo, setDemo, onContinue }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="rounded-2xl bg-white border border-ink-100 p-5">
        <h2 className="text-sm font-bold text-ink-900">Antes de empezar</h2>
        <ul className="text-xs text-ink-600 space-y-1.5 mt-3 list-disc pl-4 leading-relaxed">
          <li>Te tomará entre <strong>5 y 7 minutos</strong>.</li>
          <li>Tus respuestas son <strong>anónimas</strong>: no se registra tu nombre, email ni IP visible.</li>
          <li>Los resultados se entregan en agregado al equipo de prevención. Nadie verá tus respuestas individuales.</li>
          <li>Si quieres saltar alguna pregunta, puedes hacerlo.</li>
        </ul>
      </div>

      <div className="rounded-2xl bg-white border border-ink-100 p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-ink-900">Datos demográficos (opcional)</h3>
          <p className="text-xs text-ink-500 mt-0.5">Sirven para analizar resultados por grupo. No identifican a nadie.</p>
        </div>
        <DemoRow label="Rango de edad" options={AGE_OPTIONS} value={demo.age} onChange={(v) => setDemo({ ...demo, age: v })} />
        <DemoRow label="Antigüedad en la empresa" options={TENURE_OPTIONS} value={demo.tenure} onChange={(v) => setDemo({ ...demo, tenure: v })} />
        <DemoRow label="Género" options={GENDER_OPTIONS} value={demo.gender} onChange={(v) => setDemo({ ...demo, gender: v })} />
        <div>
          <label className="text-xs font-semibold text-ink-700 block mb-1.5">Área / departamento (opcional)</label>
          <input
            value={demo.department}
            onChange={(e) => setDemo({ ...demo, department: e.target.value })}
            placeholder="Ej: Operaciones, Comercial, RRHH…"
            maxLength={120}
            className="w-full h-10 rounded-xl border border-ink-200 px-3 text-sm"
          />
        </div>
      </div>

      <Button onClick={onContinue} className="w-full">
        Comenzar cuestionario <ChevronRight className="w-4 h-4" />
      </Button>
    </motion.div>
  )
}

function DemoRow({ label, options, value, onChange }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-700 block mb-1.5">{label}</label>
      <div className="flex gap-1.5 flex-wrap">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              value === o.v ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-700 border-ink-200 hover:border-brand-300',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function DimensionStep({ stepNumber, totalDims, dim, items, likert, answers, setAnswer, onBack, onContinue }) {
  return (
    <motion.div key={dim.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="rounded-2xl bg-brand-50/60 border border-brand-200 p-4">
        <div className="text-[10px] font-bold tracking-widest text-brand-700 uppercase">
          Sección {stepNumber} de {totalDims}
        </div>
        <h2 className="text-base font-bold text-ink-900 mt-1">{dim.label}</h2>
        <p className="text-xs text-ink-600 mt-1.5">{dim.description}</p>
      </div>

      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={it.code} className="rounded-2xl bg-white border border-ink-100 p-4">
            <div className="text-sm font-semibold text-ink-900 mb-3">
              {idx + 1}. {it.text}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {likert.map((opt) => {
                const selected = answers[it.code] === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setAnswer(it.code, opt.value)}
                    className={cn(
                      'flex-1 min-w-[100px] px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all',
                      selected
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-ink-700 border-ink-200 hover:border-brand-300',
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          <ChevronLeft className="w-4 h-4" /> Atrás
        </Button>
        <Button onClick={onContinue} className="flex-1">
          Continuar <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  )
}

function ReviewAndSubmit({ answeredCount, totalQuestions, onBack, onSubmit, submitting }) {
  const complete = answeredCount === totalQuestions
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-2xl bg-white border border-ink-100 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-ink-900 mt-4">¡Llegaste al final!</h2>
        <p className="text-sm text-ink-600 mt-2">
          Respondiste <strong>{answeredCount}</strong> de <strong>{totalQuestions}</strong> preguntas.
          {complete ? ' Perfecto.' : ' Puedes enviar igual — tu respuesta servirá si respondiste al menos la mitad.'}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack} className="flex-1">
          <ChevronLeft className="w-4 h-4" /> Revisar
        </Button>
        <Button onClick={onSubmit} disabled={submitting || answeredCount < 10} className="flex-1">
          {submitting ? 'Enviando…' : 'Enviar respuesta'}
        </Button>
      </div>
    </motion.div>
  )
}

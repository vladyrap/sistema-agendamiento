import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { ShieldCheck, Printer, ArrowLeft, AlertTriangle, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { leyKarinApi } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'

const DIM_DESCRIPTIONS = {
  exigencias:       'Carga cuantitativa, cognitiva y emocional del trabajo, y necesidad de esconder emociones.',
  trabajo_activo:   'Influencia sobre el trabajo, oportunidades de desarrollo, sentido del trabajo e integración.',
  apoyo_liderazgo:  'Claridad de rol, conflictos de rol, apoyo de superiores y de pares, calidad del liderazgo.',
  compensaciones:   'Reconocimiento, estima, inseguridad laboral y temor por el futuro del empleo.',
  doble_presencia:  'Conflicto entre demandas del trabajo remunerado y del trabajo doméstico-familiar.',
}

const DEMO_LABELS = {
  age_range: {
    menos_30: 'Menos de 30 años',
    '30_49': '30 a 49 años',
    '50_mas': '50 años o más',
  },
  tenure: {
    menos_1: 'Menos de 1 año',
    '1_5': 'Entre 1 y 5 años',
    mas_5: 'Más de 5 años',
  },
  gender: {
    f: 'Femenino',
    m: 'Masculino',
    nb: 'No binario / otro',
  },
}

export default function AdminLeyKarinPrint() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [report, setReport] = useState(null)
  const [assessment, setAssessment] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([leyKarinApi.report(id), leyKarinApi.get(id)])
      .then(([r1, r2]) => {
        setReport(r1.data)
        setAssessment(r2.data)
      })
      .catch(() => toast.error('No se pudo cargar el reporte'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>

  return (
    <div className="bg-white min-h-screen">
      {/* Toolbar — oculta al imprimir */}
      <div className="print:hidden border-b border-ink-200 sticky top-0 bg-white z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/ley-karin')}>
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> Descargar PDF / Imprimir
          </Button>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-6 sm:px-10 py-10 print:px-0 print:py-6 text-ink-900">
        {/* Encabezado del documento */}
        <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-ink-900">
          <div>
            <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-700 mb-2">
              <ShieldCheck className="w-3 h-3" /> Reporte SUSESO/ISTAS-21 · Ley 21.643
            </div>
            <h1 className="text-3xl font-bold tracking-tight leading-tight">
              Evaluación de riesgo psicosocial laboral
            </h1>
            {report?.company_name && (
              <p className="text-base text-ink-700 mt-2">
                <strong>Empresa:</strong> {report.company_name}
              </p>
            )}
            {assessment?.title && (
              <p className="text-sm text-ink-600 mt-1">
                <strong>Campaña:</strong> {assessment.title}
              </p>
            )}
          </div>
          <div className="text-right text-[11px] text-ink-500">
            <div>Generado el</div>
            <div className="font-bold text-ink-700 text-sm tabular-nums">
              {format(new Date(), "d 'de' MMMM yyyy", { locale: es })}
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-ink-500">
              <span className="w-5 h-5 rounded bg-brand-600 text-white inline-flex items-center justify-center text-[9px] font-bold">C</span>
              Calmar · miespejo.cl
            </div>
          </div>
        </div>

        {/* Mensaje si no hay datos suficientes */}
        {!report?.report_available && (
          <div className="rounded-2xl bg-amber-50 border-2 border-amber-200 p-6 mb-8">
            <div className="inline-flex items-center gap-2 text-amber-800 font-bold">
              <AlertTriangle className="w-5 h-5" /> Reporte no disponible
            </div>
            <p className="text-sm text-amber-800 mt-2">
              {report?.message || 'Se necesitan al menos 3 respuestas para preservar el anonimato.'}
            </p>
            <p className="text-sm text-amber-700 mt-3">
              Respuestas actuales: <strong>{report?.total_responses ?? 0}</strong>
              {assessment?.target_employees && (
                <> · Trabajadores totales: <strong>{assessment.target_employees}</strong></>
              )}
            </p>
          </div>
        )}

        {/* KPIs */}
        {report?.report_available && (
          <>
            <section className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-500 mb-3">Resumen ejecutivo</h2>
              <div className="grid grid-cols-3 gap-4">
                <Kpi label="Trabajadores que respondieron" value={report.total_responses} />
                <Kpi label="Participación" value={report.completion_pct != null ? `${report.completion_pct}%` : '—'} sub={assessment?.target_employees ? `${report.total_responses} de ${assessment.target_employees}` : null} />
                <Kpi label="Dimensión crítica" value={report.aggregate?.worst_dimension?.label || '—'} small sub={report.aggregate?.worst_dimension ? `${report.aggregate.worst_dimension.pct_high}% en riesgo alto` : null} />
              </div>
            </section>

            {/* Resultados por dimensión */}
            <section className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-500 mb-3">Resultados por dimensión</h2>
              <div className="space-y-4">
                {Object.entries(report.aggregate?.dimensions || {}).map(([code, dim]) => (
                  <DimensionBlock key={code} code={code} dim={dim} />
                ))}
              </div>
            </section>

            {/* Distribución demográfica */}
            {report.demographics && (
              <section className="mb-10">
                <h2 className="text-sm font-bold uppercase tracking-widest text-ink-500 mb-3">Distribución demográfica (auto-reportada)</h2>
                <div className="grid grid-cols-3 gap-4">
                  <DemoBlock title="Rango de edad"     data={report.demographics.age_range}  labels={DEMO_LABELS.age_range} />
                  <DemoBlock title="Antigüedad"        data={report.demographics.tenure}     labels={DEMO_LABELS.tenure} />
                  <DemoBlock title="Género"            data={report.demographics.gender}     labels={DEMO_LABELS.gender} />
                </div>
                {Object.keys(report.demographics.department || {}).length > 0 && (
                  <div className="mt-4">
                    <DemoBlock title="Áreas / departamentos" data={report.demographics.department} wide />
                  </div>
                )}
              </section>
            )}

            {/* Interpretación + recomendaciones */}
            <section className="mb-10">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-500 mb-3">Interpretación y recomendaciones</h2>
              <Interpretation report={report} />
            </section>
          </>
        )}

        {/* Footer legal */}
        <footer className="mt-12 pt-6 border-t border-ink-200 text-[10px] text-ink-500 leading-relaxed">
          <div className="flex items-start gap-2 mb-2">
            <Lock className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              Las respuestas individuales son <strong>anónimas</strong>. Este reporte solo presenta
              datos agregados. Se requiere un mínimo de 3 respuestas por dimensión para mostrar
              resultados, en cumplimiento de buenas prácticas de protección de datos personales
              (Ley 19.628).
            </span>
          </div>
          <p>
            Instrumento utilizado: <strong>SUSESO/ISTAS-21 versión breve</strong> (20 ítems, 5 dimensiones),
            adaptación chilena del CoPsoQ-ISTAS21. Aplicación en cumplimiento de la Ley 21.643 (Ley Karin)
            y la Norma Técnica MINSAL sobre identificación y evaluación de riesgos psicosociales en el trabajo.
            Referencia oficial: SUSESO, Manual del Método del Cuestionario SUSESO/ISTAS-21.
          </p>
          <p className="mt-2 text-ink-400">
            Reporte generado por Calmar · miespejo.cl · {format(new Date(), "yyyy-MM-dd HH:mm")} hrs
          </p>
        </footer>
      </main>

      <style>{`
        @media print {
          @page { margin: 18mm 14mm; size: A4; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          section { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

function Kpi({ label, value, sub, small }) {
  return (
    <div className="rounded-2xl border-2 border-ink-200 p-4">
      <div className="text-[10px] uppercase tracking-wide font-bold text-ink-500">{label}</div>
      <div className={cn('font-bold text-ink-900 tabular-nums mt-1', small ? 'text-base' : 'text-3xl')}>{value}</div>
      {sub && <div className="text-[11px] text-ink-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function DimensionBlock({ code, dim }) {
  const { distribution = {}, pct_high = 0, avg_risk_pct, n, label } = dim
  const total = (distribution.low || 0) + (distribution.medium || 0) + (distribution.high || 0)
  const pctLow = total ? Math.round((distribution.low || 0) * 100 / total) : 0
  const pctMed = total ? Math.round((distribution.medium || 0) * 100 / total) : 0
  const pctHigh = total ? Math.round((distribution.high || 0) * 100 / total) : 0
  const description = DIM_DESCRIPTIONS[code] || dim.description

  const tone = pctHigh >= 50 ? 'rose' : pctHigh >= 25 ? 'amber' : 'wellness'
  const borderTone = { rose: 'border-rose-300', amber: 'border-amber-300', wellness: 'border-wellness-300' }[tone]
  const textTone = { rose: 'text-rose-700', amber: 'text-amber-700', wellness: 'text-wellness-700' }[tone]

  return (
    <div className={cn('rounded-2xl border-2 p-5', borderTone)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-bold text-ink-900">{label}</h3>
          <p className="text-[11px] text-ink-600 mt-1 leading-relaxed">{description}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-wide font-bold text-ink-500">% en riesgo alto</div>
          <div className={cn('text-3xl font-bold tabular-nums leading-none mt-0.5', textTone)}>{pctHigh}%</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="text-xs text-ink-600">
          <div>Promedio de riesgo: <strong>{avg_risk_pct != null ? `${avg_risk_pct}%` : '—'}</strong> del máximo</div>
          <div className="mt-0.5">Respuestas válidas: <strong>{n}</strong></div>
        </div>
        <div>
          <div className="h-3 rounded-full overflow-hidden flex bg-ink-100">
            <div className="bg-wellness-500" style={{ width: `${pctLow}%` }} title={`Bajo ${pctLow}%`} />
            <div className="bg-amber-500"    style={{ width: `${pctMed}%` }} title={`Medio ${pctMed}%`} />
            <div className="bg-rose-500"     style={{ width: `${pctHigh}%` }} title={`Alto ${pctHigh}%`} />
          </div>
          <div className="flex gap-3 mt-1.5 text-[10px] text-ink-600">
            <span><span className="inline-block w-2 h-2 rounded-full bg-wellness-500 mr-1" />Bajo {pctLow}%</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Medio {pctMed}%</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" />Alto {pctHigh}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DemoBlock({ title, data, labels, wide }) {
  const entries = Object.entries(data || {})
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-ink-200 p-4">
        <div className="text-[10px] uppercase tracking-wide font-bold text-ink-500">{title}</div>
        <p className="text-xs text-ink-400 mt-2 italic">Sin datos.</p>
      </div>
    )
  }
  const total = entries.reduce((s, [_, v]) => s + v, 0)
  return (
    <div className={cn('rounded-2xl border-2 border-ink-200 p-4', wide && 'col-span-3')}>
      <div className="text-[10px] uppercase tracking-wide font-bold text-ink-500 mb-2">{title}</div>
      <div className="space-y-1.5">
        {entries.sort((a, b) => b[1] - a[1]).map(([key, count]) => {
          const pct = total ? Math.round(count * 100 / total) : 0
          const label = (labels && labels[key]) || key
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="w-32 text-ink-700 truncate">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-ink-100 overflow-hidden">
                <div className="h-2 bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-ink-600 tabular-nums w-12 text-right">{count} ({pct}%)</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Interpretation({ report }) {
  const dims = report.aggregate?.dimensions || {}
  const highDims = Object.entries(dims).filter(([_, d]) => d.pct_high >= 25)
  const safeDims = Object.entries(dims).filter(([_, d]) => d.pct_high < 10 && d.n > 0)

  return (
    <div className="space-y-3 text-sm text-ink-700 leading-relaxed">
      {highDims.length === 0 ? (
        <p>
          La evaluación no detectó dimensiones con un porcentaje crítico de trabajadores en riesgo
          alto. Se recomienda igualmente mantener el monitoreo periódico cada 12 meses según la
          Ley 21.643.
        </p>
      ) : (
        <>
          <p>
            Se identifican <strong>{highDims.length}</strong> dimensión(es) con porcentaje
            significativo de trabajadores en riesgo alto. Estas son las que requieren atención prioritaria:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            {highDims.map(([code, d]) => (
              <li key={code}>
                <strong>{d.label}:</strong> {d.pct_high}% de los respondedores en riesgo alto.
                Promedio de riesgo {d.avg_risk_pct}% del máximo posible.
              </li>
            ))}
          </ul>
          <p className="mt-3">
            <strong>Recomendaciones generales:</strong>
          </p>
          <ul className="list-disc pl-6 space-y-1 text-[13px]">
            <li>Convocar al Comité de Aplicación de Cuestionarios (CAC) para diseñar medidas correctivas focalizadas en las dimensiones críticas.</li>
            <li>Reaplicar el cuestionario en un plazo no mayor a 12 meses según protocolo SUSESO.</li>
            <li>Implementar acciones específicas según la(s) dimensión(es) afectada(s) — Calmar puede entregar un plan de intervención y acompañamiento psicológico individual para trabajadores que lo requieran.</li>
            <li>Capacitar a jefaturas y trabajadores en el protocolo de prevención y procedimiento de denuncia Ley Karin.</li>
          </ul>
        </>
      )}

      {safeDims.length > 0 && (
        <p className="mt-3 text-ink-600 text-[13px]">
          <strong>Fortalezas:</strong> {safeDims.map(([_, d]) => d.label).join(', ')} muestran bajos niveles
          de riesgo en la organización.
        </p>
      )}
    </div>
  )
}

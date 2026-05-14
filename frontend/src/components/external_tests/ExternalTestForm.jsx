import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Save, X, FileText, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { externalTestsApi } from '../../services/api'
import { Button } from '../../components/ui/Button'
import { Input, Label } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../lib/cn'

/**
 * Formulario para registrar el resultado de un test aplicado externamente.
 *
 * Props:
 *  - patientId
 *  - test (opcional) — para editar uno existente
 *  - onSaved (callback)
 *  - onCancel (callback)
 */
export default function ExternalTestForm({ patientId, test = null, onSaved, onCancel }) {
  const isEdit = Boolean(test?.id)
  const [catalog, setCatalog] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(true)
  const [data, setData] = useState({
    test_code: test?.test_code || '',
    test_name: test?.test_name || '',
    applied_at: test?.applied_at || new Date().toISOString().split('T')[0],
    score: test?.score || '',
    severity_label: test?.severity_label || '',
    interpretation: test?.interpretation || '',
    follow_up_date: test?.follow_up_date || '',
    notes: test?.notes || '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    externalTestsApi.catalog()
      .then((r) => setCatalog(r.data))
      .catch(() => toast.error('No se pudo cargar el catálogo'))
      .finally(() => setLoadingCatalog(false))
  }, [])

  // Agrupar catálogo por categoría
  const grouped = useMemo(() => {
    const out = {}
    for (const t of catalog) {
      if (!out[t.category]) out[t.category] = []
      out[t.category].push(t)
    }
    return out
  }, [catalog])

  function update(k, v) { setData((d) => ({ ...d, [k]: v })) }

  async function submit() {
    if (!data.test_code) {
      toast.error('Selecciona el test')
      return
    }
    if (data.test_code === 'other' && !data.test_name.trim()) {
      toast.error('Especifica el nombre del test')
      return
    }
    if (!data.applied_at) {
      toast.error('Fecha de aplicación requerida')
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...data,
        score: data.score || null,
        severity_label: data.severity_label || null,
        follow_up_date: data.follow_up_date || null,
        test_name: data.test_code === 'other' ? data.test_name.trim() : undefined,
      }
      if (isEdit) {
        await externalTestsApi.update(test.id, payload)
        toast.success('Test actualizado')
      } else {
        await externalTestsApi.create(patientId, payload)
        toast.success('Test registrado')
      }
      onSaved?.()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-brand-200 bg-brand-50/30 p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold inline-flex items-center gap-2 text-brand-800">
          <FileText className="w-4 h-4" /> {isEdit ? 'Editar resultado de test' : 'Registrar test externo'}
        </h4>
        <button onClick={onCancel} className="text-ink-500 hover:text-ink-900 p-1" aria-label="Cerrar">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>Solo registra el resultado.</strong> Aplicá el test con tu propia copia
          licenciada (manual, hoja de respuestas, software del autor) y volcá acá el score,
          severidad e interpretación clínica. El sistema no almacena los items.
        </div>
      </div>

      <div>
        <Label>Test aplicado *</Label>
        {loadingCatalog ? (
          <div className="py-4"><Spinner /></div>
        ) : (
          <select
            value={data.test_code}
            onChange={(e) => update('test_code', e.target.value)}
            className="w-full h-11 rounded-xl border border-ink-200 bg-white px-3 text-sm"
          >
            <option value="">— Selecciona un test —</option>
            {Object.entries(grouped).map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((t) => (
                  <option key={t.code} value={t.code}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {data.test_code === 'other' && (
        <div>
          <Label>Nombre del test *</Label>
          <Input
            value={data.test_name}
            onChange={(e) => update('test_name', e.target.value)}
            placeholder="Ej: Mi test personalizado"
            maxLength={200}
          />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Fecha de aplicación *</Label>
          <Input
            type="date"
            value={data.applied_at}
            onChange={(e) => update('applied_at', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div>
          <Label>Re-evaluar el</Label>
          <Input
            type="date"
            value={data.follow_up_date}
            onChange={(e) => update('follow_up_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Score / Resultado</Label>
          <Input
            value={data.score}
            onChange={(e) => update('score', e.target.value)}
            placeholder="Ej: 85, P75, T=65, CI=102"
            maxLength={100}
          />
          <p className="text-[11px] text-ink-500 mt-1">Texto libre — puede ser numérico, percentil o categorial.</p>
        </div>
        <div>
          <Label>Severidad / Clasificación</Label>
          <Input
            value={data.severity_label}
            onChange={(e) => update('severity_label', e.target.value)}
            placeholder="Ej: Leve, Moderado, Promedio, Bajo"
            maxLength={100}
          />
        </div>
      </div>

      <div>
        <Label>Interpretación clínica</Label>
        <textarea
          value={data.interpretation}
          onChange={(e) => update('interpretation', e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Resumen de hallazgos, perfil clínico, recomendaciones, etc."
          className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
        />
      </div>

      <div>
        <Label>Notas internas (opcional)</Label>
        <textarea
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Notas privadas (no visibles al paciente)."
          className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400 resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" onClick={submit} disabled={saving}>
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Registrar test'}
        </Button>
      </div>
    </motion.div>
  )
}

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Settings, Save, MessageCircle, Mail, Phone, Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { siteSettingsApi } from '../../services/api'
import { useSiteSettings } from '../../context/SiteSettingsContext'
import { Card } from '../../components/ui/Card'
import { Input, Label, Textarea } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'
import { cn } from '../../lib/cn'

export default function AdminSettings() {
  const { reload } = useSiteSettings()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    siteSettingsApi.adminGet()
      .then((r) => setData(r.data))
      .catch(() => toast.error('No se pudo cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: saved } = await siteSettingsApi.adminPut({
        whatsapp_number: data.whatsapp_number,
        contact_email: data.contact_email,
        contact_phone_display: data.contact_phone_display,
        business_hours: data.business_hours,
        notes: data.notes,
      })
      setData(saved)
      toast.success('Configuración guardada')
      reload()  // refrescar el provider global
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="py-16 flex justify-center"><Spinner size="lg" /></div>
  if (!data) return null

  const whatsappValid = data.whatsapp_number && data.whatsapp_number.replace(/\D/g, '').length >= 8
  const cleanedNumber = (data.whatsapp_number || '').replace(/\D/g, '')
  const previewWaUrl = whatsappValid ? `https://wa.me/${cleanedNumber}?text=Hola%20Calmar` : null

  return (
    <motion.div {...fadeInUp} className="space-y-7 max-w-3xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tightest inline-flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-600" />
          Configuración del sitio
        </h1>
        <p className="text-ink-500 text-sm mt-1">
          Datos de contacto que aparecen en la landing pública y en los CTAs B2B (Ley Karin).
          Los cambios se aplican inmediatamente.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* WhatsApp */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <MessageCircle className="w-4 h-4 text-wellness-600" /> WhatsApp
          </div>

          <div>
            <Label>Número (formato internacional, sin "+")</Label>
            <Input
              value={data.whatsapp_number || ''}
              onChange={(e) => setData({ ...data, whatsapp_number: e.target.value })}
              placeholder="56912345678"
              className="font-mono"
            />
            <p className="text-[11px] text-ink-500 mt-1.5">
              Ejemplo Chile: <code className="font-mono">56912345678</code>. Se aceptan espacios y guiones,
              al guardar se normalizan automáticamente.
            </p>
          </div>

          {previewWaUrl ? (
            <a
              href={previewWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-wellness-700 bg-wellness-50 border border-wellness-200 rounded-xl px-3 py-2 hover:bg-wellness-100 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Probar enlace
            </a>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5" /> Número aún no es válido (mínimo 8 dígitos)
            </div>
          )}
        </Card>

        {/* Email + teléfono display */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <Mail className="w-4 h-4 text-brand-600" /> Email y teléfono de contacto
          </div>

          <div>
            <Label>Email público</Label>
            <Input
              type="email"
              value={data.contact_email || ''}
              onChange={(e) => setData({ ...data, contact_email: e.target.value })}
              placeholder="hola@miespejo.cl"
            />
            <p className="text-[11px] text-ink-500 mt-1.5">
              Se usa como fallback si el botón de WhatsApp no está configurado.
            </p>
          </div>

          <div>
            <Label>Teléfono para mostrar (formato humano)</Label>
            <Input
              value={data.contact_phone_display || ''}
              onChange={(e) => setData({ ...data, contact_phone_display: e.target.value })}
              placeholder="+56 9 1234 5678"
            />
            <p className="text-[11px] text-ink-500 mt-1.5">
              Versión legible que se muestra al usuario (con espacios y "+"). Distinta al número de WhatsApp.
            </p>
          </div>
        </Card>

        {/* Horario + notas */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink-900">
            <Clock className="w-4 h-4 text-amber-600" /> Horario y notas
          </div>

          <div>
            <Label>Horario comercial</Label>
            <Input
              value={data.business_hours || ''}
              onChange={(e) => setData({ ...data, business_hours: e.target.value })}
              placeholder="Lun a Vie · 9:00 a 19:00"
            />
          </div>

          <div>
            <Label>Notas internas (no se muestran al público)</Label>
            <Textarea
              rows={3}
              value={data.notes || ''}
              onChange={(e) => setData({ ...data, notes: e.target.value })}
              placeholder="Ej: el número de WhatsApp lo atiende Vladimir, horario extendido en QA…"
            />
          </div>
        </Card>

        <div className="flex items-center justify-between gap-3 sticky bottom-4 bg-white border border-ink-200 shadow-soft rounded-2xl p-3">
          <div className="text-[11px] text-ink-500">
            {data.updated_at && (
              <>Última actualización: {new Date(data.updated_at).toLocaleString('es-CL')}</>
            )}
          </div>
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4" /> {saving ? 'Guardando…' : 'Guardar configuración'}
          </Button>
        </div>
      </form>
    </motion.div>
  )
}

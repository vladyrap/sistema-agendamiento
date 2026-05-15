import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { siteSettingsApi } from '../services/api'

const DEFAULT_SETTINGS = {
  whatsapp_number: '',
  contact_email: 'hola@miespejo.cl',
  contact_phone_display: '',
  business_hours: '',
}

const SiteSettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  loading: true,
  reload: () => {},
})

/**
 * Provider que carga la config pública una sola vez al inicio de la app
 * y la deja disponible para todos los componentes vía useSiteSettings().
 */
export function SiteSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    siteSettingsApi.publicGet()
      .then((r) => setSettings({ ...DEFAULT_SETTINGS, ...r.data }))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { reload() }, [reload])

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, reload }}>
      {children}
    </SiteSettingsContext.Provider>
  )
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext)
}

/**
 * Helper para construir URL de WhatsApp con mensaje pre-cargado.
 * Si el número no está configurado, devuelve null.
 */
export function buildWhatsappUrl(number, message = '') {
  if (!number || number.length < 8) return null
  const cleaned = number.replace(/\D/g, '')
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${cleaned}${encoded ? `?text=${encoded}` : ''}`
}

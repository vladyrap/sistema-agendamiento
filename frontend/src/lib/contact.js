// Contact info legacy stub — la fuente de verdad ahora es SiteSettingsContext.
//
// Para usar el número de WhatsApp en un componente:
//
//   import { useSiteSettings, buildWhatsappUrl } from '../../context/SiteSettingsContext'
//
//   const { settings } = useSiteSettings()
//   const url = buildWhatsappUrl(settings.whatsapp_number, 'Hola Calmar 👋')
//
// El admin edita estos valores en /admin/settings.
//
// Solo dejamos aquí el email por defecto como fallback (no se usa si el admin
// configura uno propio en el mantenedor).

export const FALLBACK_CONTACT_EMAIL = 'hola@miespejo.cl'

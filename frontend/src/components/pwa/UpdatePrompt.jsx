import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { onUpdateAvailable } from '../../lib/pwa'

/**
 * Toast flotante cuando hay una nueva versión del service worker esperando.
 * Click "Actualizar" → toma control el nuevo SW → la página se recarga.
 */
export default function UpdatePrompt() {
  const [workbox, setWorkbox] = useState(null)

  useEffect(() => {
    return onUpdateAvailable((wb) => setWorkbox(wb))
  }, [])

  if (!workbox) return null

  function applyUpdate() {
    workbox.messageSkipWaiting()
    // La página se recarga automáticamente cuando el nuevo SW toma control
    // (gracias al evento 'controlling' en pwa.js)
  }

  function dismiss() {
    setWorkbox(null)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50
                   rounded-2xl shadow-2xl ring-1 ring-ink-900/10 bg-white border border-brand-200 p-4"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-ink-900">Nueva versión disponible</div>
            <p className="text-xs text-ink-600 mt-0.5">Recargá para usar la versión más reciente.</p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={applyUpdate}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-ink-500 hover:text-ink-900 px-2 py-1.5"
              >
                Después
              </button>
            </div>
          </div>
          <button onClick={dismiss} aria-label="Cerrar" className="text-ink-400 hover:text-ink-700 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

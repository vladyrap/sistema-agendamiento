import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Share, Plus, Smartphone } from 'lucide-react'
import { onInstallAvailable, isStandalone, isIOS, isSafari } from '../../lib/pwa'
import { LogoMark } from '../ui/Logo'
import { cn } from '../../lib/cn'

const DISMISS_KEY = 'calmar_install_dismissed_at'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000  // no volver a mostrar por 7 días

/**
 * Banner flotante que sugiere instalar la app.
 * - Chrome/Edge/Android: usa beforeinstallprompt → muestra botón "Instalar"
 * - iOS Safari: muestra instrucciones (debe hacerse manualmente)
 * - Si ya está instalada (standalone) o se descartó recientemente: no aparece
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // No mostrar si ya está instalada
    if (isStandalone()) return

    // No mostrar si el user dismiss-eó recientemente
    const dismissed = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10)
    if (dismissed && Date.now() - dismissed < DISMISS_COOLDOWN_MS) return

    // iOS Safari: mostrar instrucciones (no hay beforeinstallprompt)
    if (isIOS() && isSafari()) {
      // Esperar unos segundos para que el usuario navegue un poco antes de mostrar
      const timer = setTimeout(() => setShow(true), 8000)
      return () => clearTimeout(timer)
    }

    // Android/Chrome: esperar el beforeinstallprompt
    const unsubscribe = onInstallAvailable((prompt) => {
      if (prompt) {
        setDeferredPrompt(prompt)
        // Mostrar el banner después de un par de segundos
        setTimeout(() => setShow(true), 3000)
      }
    })
    return unsubscribe
  }, [])

  function dismiss() {
    setShow(false)
    setShowIOSInstructions(false)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }

  async function install() {
    if (isIOS() && isSafari()) {
      setShowIOSInstructions(true)
      return
    }
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        setShow(false)
      }
    } catch {
      /* ignore */
    } finally {
      setDeferredPrompt(null)
    }
  }

  return (
    <>
      <AnimatePresence>
        {show && !showIOSInstructions && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 24 }}
            className={cn(
              'fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50',
              'rounded-2xl shadow-2xl ring-1 ring-ink-900/10',
              'bg-gradient-to-br from-brand-600 via-brand-700 to-ink-900',
              'text-white p-4 sm:p-5',
            )}
          >
            <div className="flex items-start gap-3">
              <LogoMark size={44} className="shrink-0 ring-2 ring-white/20" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold leading-tight">Instalá Calmar en tu celular</div>
                <p className="text-xs text-white/80 mt-1 leading-relaxed">
                  Acceso rápido desde el home screen, recordatorios y modo offline.
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={install}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold bg-white text-ink-900 hover:bg-ink-50 transition-colors"
                  >
                    {isIOS() && isSafari() ? <><Smartphone className="w-3.5 h-3.5" /> Ver cómo</> : <><Download className="w-3.5 h-3.5" /> Instalar</>}
                  </button>
                  <button
                    onClick={dismiss}
                    className="text-xs text-white/70 hover:text-white px-2 py-1.5"
                  >
                    Ahora no
                  </button>
                </div>
              </div>
              <button
                onClick={dismiss}
                aria-label="Cerrar"
                className="text-white/60 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de instrucciones para iOS */}
      <AnimatePresence>
        {showIOSInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={dismiss}
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <LogoMark size={42} />
                <button onClick={dismiss} className="text-ink-400 hover:text-ink-700 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold tracking-tight">Cómo instalar Calmar en iPhone</h3>
              <ol className="mt-4 space-y-3 text-sm text-ink-700">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center mt-0.5">1</span>
                  <div className="flex items-center gap-1.5">
                    Tocá el ícono <Share className="w-4 h-4 inline" strokeWidth={2.4} /> <span>"Compartir"</span> abajo en Safari
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center mt-0.5">2</span>
                  <div className="flex items-center gap-1.5">
                    Bajá y elegí <Plus className="w-4 h-4 inline" strokeWidth={2.4} /> <span>"Añadir a Pantalla de inicio"</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 font-bold text-xs flex items-center justify-center mt-0.5">3</span>
                  <div>Tocá <strong>Agregar</strong> arriba a la derecha. El ícono Calmar aparece en tu home.</div>
                </li>
              </ol>
              <button
                onClick={dismiss}
                className="mt-6 w-full rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 text-sm transition-colors"
              >
                Listo, gracias
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

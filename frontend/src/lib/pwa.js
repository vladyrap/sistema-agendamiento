/**
 * PWA helpers — registro de service worker, install prompt, update detection.
 *
 * Uso en main.jsx:
 *   import { registerPWA } from './lib/pwa'
 *   registerPWA()
 */
import { Workbox } from 'workbox-window'

// Promise que se resuelve cuando el beforeinstallprompt está disponible
let deferredInstallPrompt = null
const installListeners = new Set()
const updateListeners = new Set()

function notifyInstall() {
  installListeners.forEach((fn) => {
    try { fn(deferredInstallPrompt) } catch { /* ignore */ }
  })
}

function notifyUpdate(workbox) {
  updateListeners.forEach((fn) => {
    try { fn(workbox) } catch { /* ignore */ }
  })
}

/**
 * Registra el Service Worker y captura los eventos relevantes.
 */
export function registerPWA() {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  // beforeinstallprompt — disponible en Chrome/Edge/Android cuando la app es instalable
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
    notifyInstall()
  })

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null
    notifyInstall()
  })

  // Solo registrar el SW en producción (el build de Vite lo genera)
  // En dev no hay service worker activo (devOptions.enabled=false)
  if (import.meta.env.PROD) {
    const wb = new Workbox('/sw.js', { scope: '/' })

    // Hay una actualización esperando — el usuario decide cuando aplicar
    wb.addEventListener('waiting', () => {
      notifyUpdate(wb)
    })

    // El SW nuevo tomó control — recargamos para usar la versión nueva
    wb.addEventListener('controlling', () => {
      window.location.reload()
    })

    wb.register().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('SW register failed', err)
    })
  }
}

/**
 * Suscribirse al evento de "app instalable" o "app ya instalada".
 * Callback recibe deferredPrompt (puede ser null si ya está instalada o no disponible).
 */
export function onInstallAvailable(cb) {
  installListeners.add(cb)
  // Si ya hay prompt diferido, llamar inmediatamente
  if (deferredInstallPrompt) cb(deferredInstallPrompt)
  return () => installListeners.delete(cb)
}

/**
 * Suscribirse al evento de "hay una actualización disponible".
 * Callback recibe el workbox instance — llamar wb.messageSkipWaiting() para aplicar.
 */
export function onUpdateAvailable(cb) {
  updateListeners.add(cb)
  return () => updateListeners.delete(cb)
}

/**
 * Detecta si la app está corriendo en modo "standalone" (instalada).
 */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator?.standalone === true  // iOS
  )
}

/**
 * Detecta si es iOS Safari (que no soporta beforeinstallprompt).
 */
export function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
}

/**
 * Detecta si es Safari (incluyendo iOS Safari).
 */
export function isSafari() {
  if (typeof navigator === 'undefined') return false
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
}

import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, Calendar, ClipboardList, Sparkles, Heart, Wallet, Building2,
  AlertTriangle, CheckCircle, UserPlus, X, BellOff,
} from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { notificationsApi } from '../services/api'
import { cn } from '../lib/cn'

// Mapeo de strings de icono → componente lucide
const ICON_MAP = {
  Calendar, ClipboardList, Sparkles, Heart, Wallet, Building2,
  AlertTriangle, CheckCircle, UserPlus, X, BellOff, Bell,
}

const TONE_CLASSES = {
  brand:    'bg-brand-50 text-brand-700 ring-brand-100',
  wellness: 'bg-wellness-50 text-wellness-700 ring-wellness-100',
  amber:    'bg-amber-50 text-amber-700 ring-amber-100',
  rose:     'bg-rose-50 text-rose-700 ring-rose-100',
}

const SEEN_KEY = 'calmar_notif_seen_ids'

function loadSeen() {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

function saveSeen(set) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(set)))
  } catch { /* ignore */ }
}

/**
 * Campanita con badge de no leídos + dropdown panel.
 * "No leído" se trackea en localStorage por ID de notificación.
 *
 * placement:
 *   "down-end" (default) — panel debajo del botón, alineado al borde derecho (abre hacia la izquierda). Para top-bar.
 *   "up-start" — panel encima del botón, alineado al borde izquierdo (abre hacia la derecha). Para sidebar inferior.
 */
export default function NotificationsBell({ placement = 'down-end' }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [seen, setSeen] = useState(loadSeen())
  const boxRef = useRef(null)
  const navigate = useNavigate()

  async function load() {
    setLoading(true)
    try {
      const { data } = await notificationsApi.mine()
      setItems(data.items || [])
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // Refrescar cada 60s
    const interval = setInterval(load, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function onClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const unreadCount = items.filter((i) => !seen.has(i.id)).length

  function markAllSeen() {
    const next = new Set(seen)
    items.forEach((i) => next.add(i.id))
    setSeen(next)
    saveSeen(next)
  }

  function openItem(item) {
    // Marcar como leído
    const next = new Set(seen)
    next.add(item.id)
    setSeen(next)
    saveSeen(next)
    setOpen(false)
    if (item.link) navigate(item.link)
  }

  function toggleOpen() {
    if (!open) load()
    setOpen((v) => !v)
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-ink-100 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5 text-ink-600" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute w-[360px] max-w-[calc(100vw-2rem)] z-50',
              placement === 'up-start'
                ? 'bottom-full mb-2 left-0'
                : 'right-0 mt-2',
              'rounded-2xl bg-white shadow-2xl ring-1 ring-ink-900/10 overflow-hidden',
            )}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-2">
                <Bell className="w-4 h-4 text-brand-600" /> Notificaciones
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                    {unreadCount}
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllSeen}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                >
                  Marcar todo leído
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[480px] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="py-10 text-center text-sm text-ink-400">Cargando…</div>
              ) : items.length === 0 ? (
                <div className="py-10 text-center px-6">
                  <BellOff className="w-8 h-8 text-ink-300 mx-auto" />
                  <p className="text-sm text-ink-500 mt-2">Sin notificaciones nuevas.</p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-100">
                  {items.map((item) => {
                    const Icon = ICON_MAP[item.icon] || Bell
                    const toneClass = TONE_CLASSES[item.tone] || TONE_CLASSES.brand
                    const isUnread = !seen.has(item.id)
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => openItem(item)}
                          className={cn(
                            'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-ink-50/60 transition-colors',
                            isUnread && 'bg-brand-50/30',
                          )}
                        >
                          <div className={cn('shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ring-1', toneClass)}>
                            <Icon className="w-4 h-4" strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('text-sm font-semibold truncate', isUnread ? 'text-ink-900' : 'text-ink-700')}>
                                {item.title}
                              </span>
                              {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-brand-600 shrink-0" />}
                            </div>
                            {item.body && (
                              <p className="text-xs text-ink-600 mt-0.5 leading-snug line-clamp-2">
                                {item.body}
                              </p>
                            )}
                            {item.timestamp && (
                              <span className="text-[10px] text-ink-400 mt-1 block">
                                {formatDistanceToNow(parseISO(item.timestamp), { locale: es, addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Footer hint */}
            <div className="px-4 py-2.5 border-t border-ink-100 bg-ink-50/50">
              <p className="text-[10px] text-ink-500 text-center">
                Las notificaciones se actualizan automáticamente.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MessageCircle, X, Send, Sparkles, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/cn'
import { chatApi } from '../services/api'
import { LogoMark } from './ui/Logo'

const SUGGESTIONS = [
  '¿Qué especialidades ofrecen?',
  'Quiero ver psicólogos disponibles',
  '¿Cómo funciona el pago?',
  '¿Tienen horarios esta semana?',
]

const STORAGE_KEY = 'calmar_chat_v1'

function useStoredHistory() {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.slice(-30) : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)))
    } catch {
      /* ignore */
    }
  }, [messages])
  return [messages, setMessages]
}

function Bubble({ role, text, crisis }) {
  const isUser = role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-brand-600 text-white rounded-br-md'
            : crisis
              ? 'bg-rose-50 text-rose-900 border border-rose-200 rounded-bl-md'
              : 'bg-ink-100 text-ink-900 rounded-bl-md',
        )}
      >
        {crisis && (
          <div className="flex items-center gap-1.5 text-rose-700 text-[11px] font-semibold uppercase tracking-wide mb-1">
            <AlertTriangle size={12} /> Recurso de emergencia
          </div>
        )}
        {text}
      </div>
    </motion.div>
  )
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(null) // null = checking, true/false definido
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useStoredHistory()
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    chatApi
      .status()
      .then((r) => !cancelled && setEnabled(!!r.data?.enabled))
      .catch(() => !cancelled && setEnabled(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, sending, open])

  if (enabled === false) return null // si no está configurado, no mostramos nada

  async function send(text) {
    const clean = (text ?? '').trim()
    if (!clean || sending) return
    setInput('')
    const next = [...messages, { role: 'user', text: clean }]
    setMessages(next)
    setSending(true)
    try {
      const history = next.slice(0, -1)
      const { data } = await chatApi.send(clean, history)
      setMessages([
        ...next,
        { role: 'assistant', text: data.reply, crisis: !!data.crisis },
      ])
    } catch (e) {
      const status = e?.response?.status
      const msg =
        status === 429
          ? 'Estás enviando muchos mensajes muy rápido. Espera unos segundos.'
          : 'No pude conectar con el asistente. Intenta de nuevo en un momento.'
      setMessages([...next, { role: 'assistant', text: msg }])
    } finally {
      setSending(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  function clear() {
    setMessages([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      {/* Botón flotante */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            onClick={() => setOpen(true)}
            aria-label="Abrir chat con Calmar"
            className={cn(
              'fixed bottom-5 right-5 z-50 inline-flex items-center gap-2',
              'rounded-full pl-3 pr-4 py-3 shadow-brand text-white text-sm font-semibold',
              'bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800',
              'hover:shadow-brand-lg hover:-translate-y-0.5 transition-all',
            )}
          >
            <MessageCircle size={18} strokeWidth={2.4} />
            <span>Hablar con Calmar</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel de chat */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className={cn(
              'fixed z-50 right-4 bottom-4',
              'w-[calc(100vw-2rem)] sm:w-[380px] max-w-[420px]',
              'h-[min(640px,80vh)]',
              'flex flex-col rounded-3xl overflow-hidden',
              'bg-white shadow-2xl ring-1 ring-ink-900/10',
            )}
          >
            {/* Header */}
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-white',
                'bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800',
              )}
            >
              <LogoMark size={36} className="ring-2 ring-white/20" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[15px] font-bold leading-tight">
                  Calmar <Sparkles size={13} className="opacity-90" />
                </div>
                <div className="text-[11px] text-white/80 leading-tight">
                  Asistente virtual · respondo en segundos
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar chat"
                className="rounded-full p-1.5 hover:bg-white/15 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mensajes */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3.5 py-4 space-y-2.5 bg-gradient-to-b from-ink-50/40 to-white"
            >
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="bg-ink-100 text-ink-900 max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[14px] leading-relaxed">
                    Hola, soy <strong>Calmar</strong> 👋 te ayudo a encontrar profesionales,
                    revisar horarios y resolver dudas sobre tu reserva. ¿En qué puedo ayudarte?
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className={cn(
                          'text-left text-[12.5px] leading-snug',
                          'px-3 py-2 rounded-xl border border-ink-200 bg-white',
                          'hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700',
                          'transition-colors',
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, idx) => (
                <Bubble key={idx} role={m.role} text={m.text} crisis={m.crisis} />
              ))}

              {sending && (
                <div className="flex items-center gap-2 px-1 text-ink-500 text-[12px]">
                  <Loader2 size={14} className="animate-spin" />
                  Calmar está pensando…
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-ink-100 bg-white px-2.5 py-2.5">
              {messages.length > 0 && (
                <button
                  onClick={clear}
                  className="text-[11px] text-ink-500 hover:text-ink-700 mb-1.5 ml-1"
                >
                  Limpiar conversación
                </button>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  rows={1}
                  placeholder="Escribe tu mensaje…"
                  className={cn(
                    'flex-1 resize-none rounded-2xl border border-ink-200 px-3.5 py-2.5',
                    'text-[14px] leading-snug focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-400',
                    'max-h-32',
                  )}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || sending}
                  className={cn(
                    'rounded-full p-2.5',
                    'bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800',
                    'text-white shadow-brand-sm hover:shadow-brand transition-all',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                  aria-label="Enviar mensaje"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="text-[10px] text-ink-400 mt-1.5 ml-1">
                No reemplaza una consulta clínica. En emergencias llama al 131 o *4141.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

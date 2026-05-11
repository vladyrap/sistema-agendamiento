import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'

export function Modal({ open, onClose, title, description, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            className={cn(
              'relative w-full bg-white rounded-2xl shadow-soft-lg border border-ink-100 overflow-hidden',
              widths[size],
            )}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
            {(title || description) && (
              <div className="p-6 pb-4 pr-12">
                {title && <h3 className="text-lg font-semibold tracking-tight text-ink-900">{title}</h3>}
                {description && <p className="text-sm text-ink-500 mt-1">{description}</p>}
              </div>
            )}
            <div className="p-6 pt-0">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

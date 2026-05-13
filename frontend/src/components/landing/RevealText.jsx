import React from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '../../lib/cn'

/**
 * Texto que se "rearma" al entrar en viewport:
 * cada palabra aparece desde abajo con un blur que se va.
 *
 * Para textos largos: dividimos por palabras y animamos con stagger.
 * En `prefers-reduced-motion`, mostramos el texto plano sin animación.
 */
export default function RevealText({
  children,
  className = '',
  as: Tag = 'span',
  delay = 0,
  staggerWord = 0.045,
}) {
  const reduce = useReducedMotion()
  const ref = React.useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const text = typeof children === 'string' ? children : ''
  if (!text || reduce) {
    return <Tag ref={ref} className={className}>{children}</Tag>
  }

  const words = text.split(' ')

  return (
    <Tag ref={ref} className={cn('inline', className)}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={
            inView
              ? { opacity: 1, y: 0, filter: 'blur(0px)' }
              : { opacity: 0, y: 16, filter: 'blur(8px)' }
          }
          transition={{
            duration: 0.55,
            delay: delay + i * staggerWord,
            ease: [0.21, 0.47, 0.32, 0.98],
          }}
          className="inline-block"
          style={{ willChange: 'transform, opacity, filter' }}
        >
          {word}
          {i < words.length - 1 && ' '}
        </motion.span>
      ))}
    </Tag>
  )
}

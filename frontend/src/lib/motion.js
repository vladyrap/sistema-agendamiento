// Variants reutilizables de framer-motion.
// Mantén las animaciones cortas (≤250ms) y sutiles.

export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.25 },
}

export const stagger = (delay = 0.04) => ({
  animate: {
    transition: { staggerChildren: delay, delayChildren: 0.05 },
  },
})

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
}

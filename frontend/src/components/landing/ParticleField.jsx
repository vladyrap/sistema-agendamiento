import React, { useEffect, useRef } from 'react'

/**
 * Canvas-based animated particle field with mouse-reactive connections.
 *
 * - Particles drift slowly in a gentle 2D space with parallax depth.
 * - Each particle is connected to its near neighbors via faint lines.
 * - Lines to particles near the cursor get bolder, creating constellations.
 * - Respects `prefers-reduced-motion`.
 */
export default function ParticleField({
  density = 0.00012,
  maxParticles = 110,
  baseColor = '99, 102, 241', // brand-500 in rgb (no commas at the end)
  accentColor = '34, 211, 238', // cyan-400
  className = '',
}) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches

    let width = 0
    let height = 0
    let dpr = Math.min(window.devicePixelRatio || 1, 2)
    let particles = []
    let raf = 0
    const mouse = { x: -9999, y: -9999, inside: false }

    function resize() {
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    function seed() {
      const target = Math.min(
        Math.max(Math.floor(width * height * density), 24),
        maxParticles
      )
      particles = new Array(target).fill(0).map(() => spawn())
    }

    function spawn() {
      const z = Math.random() * 0.75 + 0.25 // depth 0.25..1
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15 * z,
        vy: (Math.random() - 0.5) * 0.15 * z,
        r: 0.6 + z * 1.4, // bigger if closer
        z,
        twinkle: Math.random() * Math.PI * 2,
      }
    }

    function tick(t) {
      ctx.clearRect(0, 0, width, height)

      // Update + draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (!prefersReducedMotion) {
          p.x += p.vx
          p.y += p.vy
          p.twinkle += 0.01
          if (p.x < -10) p.x = width + 10
          if (p.x > width + 10) p.x = -10
          if (p.y < -10) p.y = height + 10
          if (p.y > height + 10) p.y = -10
        }

        const alpha =
          (0.35 + 0.25 * Math.sin(p.twinkle)) * (0.45 + 0.55 * p.z)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${baseColor}, ${alpha.toFixed(3)})`
        ctx.fill()
      }

      // Connections — pair-wise, capped distance to keep it cheap.
      const linkDist = 110
      const linkDistSq = linkDist * linkDist
      const mouseRadius = 160
      const mouseRadiusSq = mouseRadius * mouseRadius

      for (let i = 0; i < particles.length; i++) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d2 = dx * dx + dy * dy
          if (d2 > linkDistSq) continue

          const t = 1 - d2 / linkDistSq
          let alpha = t * 0.10 * Math.min(a.z, b.z)
          let color = baseColor

          if (mouse.inside) {
            const mdx = (a.x + b.x) * 0.5 - mouse.x
            const mdy = (a.y + b.y) * 0.5 - mouse.y
            const md2 = mdx * mdx + mdy * mdy
            if (md2 < mouseRadiusSq) {
              const boost = 1 - md2 / mouseRadiusSq
              alpha += boost * 0.35
              color = accentColor
            }
          }

          if (alpha < 0.01) continue
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.strokeStyle = `rgba(${color}, ${alpha.toFixed(3)})`
          ctx.lineWidth = 0.6
          ctx.stroke()
        }
      }

      raf = requestAnimationFrame(tick)
    }

    function onMove(e) {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.inside =
        mouse.x >= 0 && mouse.x <= width && mouse.y >= 0 && mouse.y <= height
    }
    function onLeave() {
      mouse.inside = false
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseleave', onLeave)
    }
  }, [density, maxParticles, baseColor, accentColor])

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
      aria-hidden
    />
  )
}

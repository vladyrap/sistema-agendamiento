import React, { useState } from 'react'
import toast from 'react-hot-toast'
import { Sparkles } from 'lucide-react'
import { reviewsApi } from '../../services/api'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Textarea, Label } from '../ui/Input'
import { StarInput } from '../ui/Stars'

export function ReviewForm({ open, onClose, appointment, onSubmitted }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!appointment) return
    if (rating < 1) {
      toast.error('Selecciona al menos una estrella')
      return
    }
    setSubmitting(true)
    try {
      await reviewsApi.create({
        appointment_id: appointment.id,
        rating,
        comment: comment.trim() || null,
      })
      toast.success('¡Gracias por tu reseña!')
      onSubmitted?.()
      onClose?.()
      setRating(5)
      setComment('')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al enviar la reseña')
    } finally {
      setSubmitting(false)
    }
  }

  if (!appointment) return null
  const fullName = `${appointment.doctor.user.first_name} ${appointment.doctor.user.last_name}`

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Califica tu consulta"
      description={`¿Cómo fue tu experiencia con Ps. ${fullName}?`}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col items-center gap-2 py-4">
          <StarInput value={rating} onChange={setRating} size="xl" />
          <span className="text-sm text-ink-500 tabular-nums">
            {['', 'Muy mala', 'Mala', 'Aceptable', 'Buena', 'Excelente'][rating]}
          </span>
        </div>

        <div>
          <Label>Comentario <span className="text-ink-400 font-normal">(opcional)</span></Label>
          <Textarea
            rows={4}
            placeholder="Cuéntanos qué te pareció. Tu opinión ayuda a otros pacientes."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
          />
          <div className="text-[11px] text-ink-400 mt-1 text-right tabular-nums">{comment.length}/500</div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={submitting}>
            {submitting ? 'Enviando...' : <>Publicar reseña <Sparkles className="w-4 h-4" /></>}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

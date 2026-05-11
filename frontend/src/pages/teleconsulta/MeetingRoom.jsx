import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Clock, Video, AlertCircle } from 'lucide-react'
import { appointmentsApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import { fadeInUp } from '../../lib/motion'

export default function MeetingRoom() {
  const { id } = useParams()
  const { user } = useAuth()
  const [meeting, setMeeting] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    setError('')
    appointmentsApi.meeting(id)
      .then((r) => setMeeting(r.data))
      .catch((err) => setError(err.response?.data?.detail || 'No se pudo cargar la sala'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [id])

  // Cuando la sala aún no está abierta, refresca cada 30s para abrirla automáticamente.
  useEffect(() => {
    if (!meeting || meeting.available || meeting.expired) return
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting])

  const homePath = user?.role === 'doctor' ? '/doctor' :
                   user?.role === 'receptionist' ? '/reception/appointments' :
                   '/patient/appointments'

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="bg-white border-b border-ink-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to={homePath} className="inline-flex items-center gap-1.5 text-sm text-ink-600 hover:text-ink-900 font-medium">
            <ArrowLeft className="w-4 h-4" /> Salir de la sala
          </Link>
          <div className="text-xs text-ink-500 inline-flex items-center gap-1.5">
            <Video className="w-3.5 h-3.5" /> Teleconsulta
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="py-20 flex justify-center"><Spinner size="lg" /></div>
        ) : error ? (
          <motion.div {...fadeInUp}>
            <Card className="p-8 max-w-md mx-auto text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h1 className="text-lg font-semibold mt-4">No puedes entrar a esta sala</h1>
              <p className="text-sm text-ink-500 mt-1.5">{error}</p>
              <Link to={homePath} className="block mt-5">
                <Button variant="secondary" className="w-full">Volver</Button>
              </Link>
            </Card>
          </motion.div>
        ) : meeting?.expired ? (
          <Card className="p-8 max-w-md mx-auto text-center">
            <h1 className="text-lg font-semibold">La sala ya cerró</h1>
            <p className="text-sm text-ink-500 mt-1.5">El horario de esta cita ya pasó.</p>
            <Link to={homePath} className="block mt-5">
              <Button variant="secondary" className="w-full">Volver</Button>
            </Link>
          </Card>
        ) : !meeting?.available ? (
          <motion.div {...fadeInUp}>
            <Card className="p-8 max-w-md mx-auto text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 mx-auto flex items-center justify-center">
                <Clock className="w-7 h-7 text-brand-600" />
              </div>
              <h1 className="text-lg font-semibold mt-4">La sala aún no se abre</h1>
              <p className="text-sm text-ink-500 mt-1.5">
                Falta{meeting.minutes_until_open === 1 ? '' : 'n'} <strong className="tabular-nums">{meeting.minutes_until_open}</strong> minutos para que se habilite.
                Se abre 15 min antes del inicio.
              </p>
              <p className="text-xs text-ink-400 mt-3">Esta página se actualiza automáticamente.</p>
              <Link to={homePath} className="block mt-5">
                <Button variant="secondary" className="w-full">Volver mientras tanto</Button>
              </Link>
            </Card>
          </motion.div>
        ) : (
          <Card className="p-2 overflow-hidden">
            <iframe
              title="Teleconsulta"
              src={`${meeting.room_url}#userInfo.displayName=%22${encodeURIComponent(`${user?.first_name || ''} ${user?.last_name || ''}`)}%22&config.subject=%22${encodeURIComponent(meeting.subject || 'Cita')}%22&config.prejoinPageEnabled=false`}
              allow="camera; microphone; fullscreen; speaker; display-capture"
              className="w-full rounded-xl border-0"
              style={{ height: 'calc(100vh - 120px)' }}
            />
          </Card>
        )}
      </main>
    </div>
  )
}

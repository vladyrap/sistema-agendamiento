import React from 'react'
import { Home, CalendarDays, CalendarPlus, Users } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'

const links = [
  { to: '/reception',              icon: Home,         label: 'Inicio', end: true },
  { to: '/reception/book',         icon: CalendarPlus, label: 'Reservar' },
  { to: '/reception/appointments', icon: CalendarDays, label: 'Citas' },
  { to: '/reception/patients',     icon: Users,        label: 'Pacientes' },
]

export default function ReceptionLayout() {
  return <AppShell links={links} basePath="/reception" brandTag="Recepción" />
}

import React from 'react'
import { Home, CalendarDays, Clock, User, Users, Shield } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'

const links = [
  { to: '/doctor',              icon: Home,         label: 'Inicio', end: true },
  { to: '/doctor/schedule',     icon: CalendarDays, label: 'Agenda' },
  { to: '/doctor/patients',     icon: Users,        label: 'Pacientes' },
  { to: '/doctor/tutors',       icon: Shield,       label: 'Tutores' },
  { to: '/doctor/availability', icon: Clock,        label: 'Disponibilidad' },
  { to: '/doctor/profile',      icon: User,         label: 'Mi perfil' },
]

export default function DoctorLayout() {
  return <AppShell links={links} basePath="/doctor" brandTag="Profesional" />
}

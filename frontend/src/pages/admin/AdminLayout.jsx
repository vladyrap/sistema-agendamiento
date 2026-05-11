import React from 'react'
import { LayoutDashboard, Users, Stethoscope, ConciergeBell, CalendarDays, Tag } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'

const links = [
  { to: '/admin',                 icon: LayoutDashboard, label: 'Dashboard',     end: true },
  { to: '/admin/users',           icon: Users,           label: 'Usuarios' },
  { to: '/admin/doctors',         icon: Stethoscope,     label: 'Médicos' },
  { to: '/admin/receptionists',   icon: ConciergeBell,   label: 'Recepcionistas' },
  { to: '/admin/appointments',    icon: CalendarDays,    label: 'Citas' },
  { to: '/admin/specialties',     icon: Tag,             label: 'Especialidades' },
]

export default function AdminLayout() {
  return <AppShell links={links} basePath="/admin" brandTag="Admin" />
}

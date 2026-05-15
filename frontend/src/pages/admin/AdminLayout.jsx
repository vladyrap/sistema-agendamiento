import React from 'react'
import { LayoutDashboard, Users, Stethoscope, ConciergeBell, CalendarDays, Tag, Building2, Gift, ShieldCheck, Settings, ShieldAlert } from 'lucide-react'
import { AppShell } from '../../components/layout/AppShell'

const links = [
  { to: '/admin',                 icon: LayoutDashboard, label: 'Dashboard',     end: true },
  { to: '/admin/users',           icon: Users,           label: 'Usuarios' },
  { to: '/admin/doctors',         icon: Stethoscope,     label: 'Psicólogos/as' },
  { to: '/admin/receptionists',   icon: ConciergeBell,   label: 'Recepcionistas' },
  { to: '/admin/appointments',    icon: CalendarDays,    label: 'Citas' },
  { to: '/admin/specialties',     icon: Tag,             label: 'Especialidades' },
  { to: '/admin/companies',       icon: Building2,       label: 'Empresas' },
  { to: '/admin/ley-karin',       icon: ShieldCheck,     label: 'Ley Karin' },
  { to: '/admin/gifts',           icon: Gift,            label: 'Gift Cards' },
  { to: '/admin/audit-log',       icon: ShieldAlert,     label: 'Auditoría' },
  { to: '/admin/settings',        icon: Settings,        label: 'Configuración' },
]

export default function AdminLayout() {
  return <AppShell links={links} basePath="/admin" brandTag="Admin" />
}

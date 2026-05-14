import React from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { Home, Search, Calendar, User, LogOut, Bell, Heart, ClipboardList, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../../components/ui/Logo'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'

const links = [
  { to: '/patient',                icon: Home,          label: 'Inicio',     end: true },
  { to: '/patient/search',         icon: Search,        label: 'Buscar' },
  { to: '/patient/appointments',   icon: Calendar,      label: 'Mis citas' },
  { to: '/patient/mood',           icon: Heart,         label: 'Diario' },
  { to: '/patient/homework',       icon: ClipboardList, label: 'Tareas' },
  { to: '/patient/questionnaires', icon: Sparkles,      label: 'Tests' },
  { to: '/patient/profile',        icon: User,          label: 'Mi perfil' },
]

export default function PatientLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-ink-100">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/patient">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {links.map(({ to, icon: Icon, label, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    cn(
                      'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                    )
                  }
                >
                  <Icon className="w-4 h-4" strokeWidth={2.2} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-5 h-5 text-ink-600" strokeWidth={2} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-500 ring-2 ring-white" />
            </Button>
            <Link to="/patient/profile" className="hidden sm:flex items-center gap-3 pl-3 ml-1 border-l border-ink-200 hover:opacity-80">
              <div className="text-right">
                <div className="text-sm font-semibold text-ink-900 leading-tight">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-[11px] text-ink-500 leading-tight">Paciente</div>
              </div>
              <Avatar name={`${user?.first_name || ''} ${user?.last_name || ''}`} size="sm" />
            </Link>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
              <LogOut className="w-4 h-4 text-ink-600" />
            </Button>
          </div>
        </div>

        <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {links.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100',
                )
              }
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

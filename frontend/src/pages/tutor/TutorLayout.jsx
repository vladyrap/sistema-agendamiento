import React from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import { Home, Users, LogOut, Bell, Shield } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Logo } from '../../components/ui/Logo'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'

const links = [
  { to: '/tutor',          icon: Home,  label: 'Mis pacientes', end: true },
]

export default function TutorLayout() {
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
            <Link to="/tutor">
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
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100 px-2.5 py-1 rounded-full">
              <Shield className="w-3 h-3" /> Tutor
            </span>
            <div className="hidden sm:flex items-center gap-3 pl-3 ml-1 border-l border-ink-200">
              <div className="text-right">
                <div className="text-sm font-semibold text-ink-900 leading-tight">
                  {user?.first_name} {user?.last_name}
                </div>
                <div className="text-[11px] text-ink-500 leading-tight">Cuenta tutor</div>
              </div>
              <Avatar name={`${user?.first_name || ''} ${user?.last_name || ''}`} size="sm" />
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
              <LogOut className="w-4 h-4 text-ink-600" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

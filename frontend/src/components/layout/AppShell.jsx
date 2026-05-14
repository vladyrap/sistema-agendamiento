import React from 'react'
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Logo, LogoMark } from '../ui/Logo'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { cn } from '../../lib/cn'
import NotificationsBell from '../NotificationsBell'

const roleLabels = { admin: 'Administrador', doctor: 'Profesional', patient: 'Paciente', receptionist: 'Recepcionista' }

export function AppShell({ links, basePath, brandTag }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-white border-r border-ink-100">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <LogoMark size={32} />
          <div className="leading-tight">
            <div className="text-[14px] font-bold tracking-tight text-ink-900">
              Calmar<span className="text-brand-600">.</span>
            </div>
            {brandTag && <div className="text-[10px] font-semibold text-ink-400 uppercase tracking-wider">{brandTag}</div>}
          </div>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {links.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-brand-600 rounded-r-full" />
                  )}
                  <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-ink-100">
          <div className="flex items-center justify-between mb-2 px-2">
            <NotificationsBell />
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="p-1.5 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-ink-50/60">
            <Avatar name={`${user?.first_name || ''} ${user?.last_name || ''}`} size="sm" />
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-sm font-semibold text-ink-900 truncate">
                {user?.first_name} {user?.last_name}
              </div>
              <div className="text-[11px] text-ink-500 truncate">{roleLabels[user?.role]}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-ink-100">
          <div className="px-4 h-14 flex items-center justify-between">
            <Link to={basePath}><Logo /></Link>
            <div className="flex items-center gap-1">
              <NotificationsBell />
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Cerrar sesión">
                <LogOut className="w-4 h-4 text-ink-600" />
              </Button>
            </div>
          </div>
          <nav className="flex items-center gap-1 px-3 pb-2 overflow-x-auto">
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

        <main className="flex-1 px-5 sm:px-8 py-6 sm:py-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const roleLabels = { patient: 'Paciente', doctor: 'Médico', admin: 'Admin' }

export default function Navbar({ links = [] }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <Link className="navbar-brand" to="/">🏥 Agendamiento Clínico</Link>
      <div className="navbar-links">
        {links.map(({ to, label }) => (
          <Link key={to} to={to}>{label}</Link>
        ))}
        {user && (
          <>
            <span style={{ color: 'var(--gray-500)', fontSize: '0.85rem' }}>
              {user.first_name} · <strong>{roleLabels[user.role]}</strong>
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
          </>
        )}
      </div>
    </nav>
  )
}

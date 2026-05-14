import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles.css'
import { registerPWA } from './lib/pwa'

// Registra el Service Worker (solo en producción)
registerPWA()

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#0f172a',
          color: '#fff',
          fontSize: 14,
          fontWeight: 500,
          borderRadius: 12,
          padding: '10px 14px',
          boxShadow: '0 12px 28px -8px rgba(15,23,42,0.35)',
        },
        success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  </BrowserRouter>
)

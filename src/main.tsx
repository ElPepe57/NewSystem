import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { tesoreriaService } from './services/tesoreria.service'
import { auth } from './lib/firebase'

// Exponer servicios en consola para migraciones y debug
if (typeof window !== 'undefined') {
  (window as any).__services = { tesoreriaService, auth };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import AdminApp from './components/admin/AdminApp.tsx'
import StaffApp from './components/staff/StaffApp.tsx'
import PortalSelection from './components/PortalSelection.tsx'

const isAdminRoute = window.location.pathname === '/admin' || window.location.pathname.startsWith('/admin/')
const isStaffRoute = window.location.pathname === '/staff' || window.location.pathname.startsWith('/staff/')
const isPortalSelection = window.location.pathname === '/'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPortalSelection ? <PortalSelection /> : isAdminRoute ? <AdminApp /> : isStaffRoute ? <StaffApp /> : <App />}
  </StrictMode>,
)

import { useState } from 'react'
import AuthProvider from './context/AuthProvider'
import { useAuth } from './context/AuthContext'
import { Brand, Icon, RoleBadge, Notice, State } from './components/UI'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Management from './pages/Management'
import Reports from './pages/Reports'
import Audit from './pages/Audit'
import './App.css'

const navigation = [
  ['dashboard', 'Inicio', 'grid', ['admin', 'manager', 'employee', 'auditor']],
  ['inventory', 'Inventario', 'box', ['admin', 'manager', 'employee', 'auditor']],
  ['users', 'Usuarios', 'users', ['admin', 'auditor']],
  ['stores', 'Tiendas', 'store', ['admin', 'auditor']],
  ['reports', 'Reportes', 'report', ['admin', 'manager', 'auditor']],
  ['audit', 'Auditoría', 'shield', ['admin', 'auditor']],
]
function Workspace() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('dashboard')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function signOut() {
    if (busy) return
    setBusy(true); setError('')
    try { await logout() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const items = navigation.filter(item => item[3].includes(user.role))
  const current = items.find(item => item[0] === page) || items[0]
  return <div className="workspace"><aside className="sidebar"><Brand/><div className="nav-label">ESPACIO DE TRABAJO</div><nav>{items.map(([key, title, icon]) => <button key={key} className={current[0] === key ? 'active' : ''} onClick={() => setPage(key)}><Icon name={icon}/>{title}{current[0] === key && <span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="security-card"><Icon name="shield" size={23}/><strong>Tu cuenta está protegida</strong><p>Verificación en dos pasos activa.</p><span className="status-dot"/> MFA verificado</div><span className="sidebar-version">TechStore <span>Laboratorio 08</span></span></div></aside><div className="workspace-main"><header className="topbar"><div className="breadcrumb">Espacio de trabajo <span>/</span><strong>{current[1]}</strong></div><div className="header-user"><span className="header-store"><Icon name="store" size={16}/>{user.store_name}</span><div className="header-divider"/><span className="avatar">{user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('')}</span><div><strong>{user.full_name}</strong><RoleBadge role={user.role}/></div><button className="icon-button" title="Cerrar sesión" aria-label="Cerrar sesión" onClick={signOut} disabled={busy}><Icon name="logout"/></button></div></header><main className="content"><Notice>{error}</Notice>{current[0] === 'dashboard' && <Dashboard navigate={setPage}/>} {current[0] === 'inventory' && <Inventory/>}{['users', 'stores'].includes(current[0]) && <Management key={current[0]} resource={current[0]}/>} {current[0] === 'reports' && <Reports/>}{current[0] === 'audit' && <Audit/>}</main><footer className="workspace-footer"><span>TechStore · Gestión de inventario</span><span><span className="status-dot"/> Sesión protegida</span></footer></div></div>
}
function Session() {
  const { user, loading } = useAuth()
  if (loading) return <div className="boot"><Brand/><State loading/></div>
  return user ? <Workspace/> : <Login/>
}
export default function App() { return <AuthProvider><Session/></AuthProvider> }

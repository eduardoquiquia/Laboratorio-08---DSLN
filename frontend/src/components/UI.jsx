import { useEffect, useRef } from 'react'
import { roles } from '../lib/roles'

const icons = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  box: <><path d="m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5"/></>,
  users: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
  store: <><path d="M3 10V4h18v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 13v8h14v-8M9 21v-6h6v6"/></>,
  report: <><path d="M14 3H5v18h14V8zM14 3v5h5M8 16v2M12 12v6M16 14v4"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/></>,
  logout: <><path d="M10 4H4v16h6M9 12h12m-5-5 5 5-5 5"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  alert: <><path d="m12 3 10 18H2zM12 9v5"/><path d="M12 17h.01"/></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>,
  edit: <><path d="m15 4 5 5-11 11H4v-5zM13 6l5 5"/></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
}

export function Icon({ name, size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name] || icons.box}</svg>
}
export function Brand() { return <div className="brand"><span className="brand-icon"><Icon name="box" size={25}/></span><span>Tech<span className="brand-light">Store</span><small>INVENTARIO & CONTROL</small></span></div> }
export function Notice({ children, type = 'error' }) { return children ? <div className={`notice ${type}`} role={type === 'error' ? 'alert' : 'status'}><Icon name={type === 'error' ? 'alert' : 'check'}/><span>{children}</span></div> : null }
export function State({ loading, error, empty, children }) {
  if (loading) return <div className="empty"><span className="spinner"/>Cargando información…</div>
  if (error) return <Notice>{error}</Notice>
  if (empty) return <div className="empty"><Icon name="box" size={34}/><strong>No hay resultados</strong><span>Prueba con otros filtros o agrega un registro.</span></div>
  return children
}
export function Modal({ title, onClose, children, busy }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); if (!busy) onClose() }}>
    <div className="modal-title"><h2>{title}</h2><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Cerrar"><Icon name="close"/></button></div>{children}
  </dialog>
}
export function PageTitle({ eyebrow = 'TU ESPACIO DE TRABAJO', title, description, action }) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
export function RoleBadge({ role }) { return <span className="badge purple">{roles[role]}</span> }
export function StockBadge({ product }) { return <span className={`badge ${product.low_stock ? 'warning' : 'success'}`}>{product.stock === 0 ? 'Sin stock' : product.low_stock ? 'Stock bajo' : 'Disponible'}</span> }
export function Field({ label, children, className = '' }) { return <label className={`field ${className}`}><span>{label}</span>{children}</label> }
export function Money({ value }) { return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(value)) }

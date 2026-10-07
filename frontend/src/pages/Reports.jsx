import { useDeferredValue, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { query, download } from '../lib/api'
import useData from '../lib/useData'
import { PageTitle, Icon, State, Notice } from '../components/UI'
import ProductTable from '../components/ProductTable'
import Filters from '../components/Filters'

export default function Reports() {
  const { user } = useAuth()
  const [kind, setKind] = useState('stock')
  const [filters, setFilters] = useState({ search: '', store: '', category: '', low_stock: '' })
  const params = query({ ...useDeferredValue(filters), kind })
  const { data, loading, error } = useData(`/reports/?${params}`)
  const { data: stores } = useData('/stores/')
  const [busy, setBusy] = useState(false)
  const [exportError, setExportError] = useState('')
  async function exportFile(format) {
    if (busy) return
    setBusy(true); setExportError('')
    try { await download(`/reports/?${params}&format=${format}`, `techstore-${kind}.${format}`) }
    catch (e) { setExportError(e.message) } finally { setBusy(false) }
  }
  return <><PageTitle title="Reportes" description="Información clara para tomar mejores decisiones."/><div className="report-options">{[['stock', 'Stock por Tienda', 'El inventario completo de tu alcance.', 'store'], ['low', 'Productos con Stock Bajo', 'Identifica lo que necesita reposición.', 'alert']].map(([key, title, desc, icon]) => <button className={`report-option ${kind === key ? 'selected' : ''}`} key={key} onClick={() => setKind(key)}><span className="metric-icon"><Icon name={icon} size={24}/></span><span><strong>{title}</strong><small>{desc}</small></span><span className="radio-dot"/></button>)}</div><Notice>{exportError}</Notice><section className="panel"><Filters filters={filters} setFilters={setFilters} stores={stores} global={['admin', 'auditor'].includes(user.role)}/><div className="panel-heading"><div><h2>Vista previa</h2><p>{data?.length ?? '…'} productos · Las descargas incluyen los filtros seleccionados y la fecha de generación.</p></div><div className="button-group"><button className="secondary" disabled={busy || loading || !!error} onClick={() => exportFile('pdf')}><Icon name="download" size={16}/> PDF</button><button className="primary" disabled={busy || loading || !!error} onClick={() => exportFile('xlsx')}><Icon name="download" size={16}/> Excel</button></div></div><State loading={loading} error={error} empty={!data?.length}><ProductTable products={data || []} report/></State></section></>
}

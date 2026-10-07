import { useDeferredValue, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api, query } from '../lib/api'
import useData from '../lib/useData'
import { PageTitle, Icon, State, Modal, Field, Notice } from '../components/UI'
import ProductTable from '../components/ProductTable'
import Filters from '../components/Filters'

export default function Inventory() {
  const { user } = useAuth()
  const global = ['admin', 'auditor'].includes(user.role)
  const canEdit = ['admin', 'manager'].includes(user.role)
  const [filters, setFilters] = useState({ search: '', category: '', store: '', low_stock: '' })
  const deferredFilters = useDeferredValue(filters)
  const [revision, setRevision] = useState(0)
  const { data: products, loading, error } = useData(`/products/?${query(deferredFilters)}`, revision)
  const { data: stores } = useData('/stores/')
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  function open(type, product = {}) { setFormError(''); setModal({ type, product }) }
  async function save(event) {
    event.preventDefault()
    if (busy) return
    const values = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true); setFormError(''); setMessage('')
    try {
      const { type, product } = modal
      if (type === 'delete') await api(`/products/${product.id}/`, { method: 'DELETE' })
      else if (type === 'stock') await api(`/products/${product.id}/stock/`, { method: 'PATCH', body: { stock: Number(values.stock) } })
      else {
        const body = { ...values, stock: Number(values.stock), minimum_stock: Number(values.minimum_stock) }
        if (user.role === 'manager') delete body.store
        await api(product.id ? `/products/${product.id}/` : '/products/', { method: product.id ? 'PATCH' : 'POST', body })
      }
      setModal(null); setRevision(value => value + 1); setMessage('¡Listo! Tu inventario está actualizado.')
    } catch (e) { setFormError(e.message) } finally { setBusy(false) }
  }
  const p = modal?.product
  return <><PageTitle title="Inventario" description="Cada producto, cada unidad, en el lugar correcto." action={canEdit && <button className="primary" onClick={() => open('edit')}><Icon name="plus" size={18}/> Agregar producto</button>}/><Notice type="success">{message}</Notice><section className="panel"><Filters filters={filters} setFilters={setFilters} stores={stores} global={global}/><div className="list-caption"><span>Catálogo de productos</span><span>{products?.length ?? '…'} resultados</span></div><State loading={loading} error={error} empty={!products?.length}><ProductTable products={products || []} onEdit={canEdit ? product => open('edit', product) : null} onDelete={canEdit ? product => open('delete', product) : null} onStock={user.role !== 'auditor' ? product => open('stock', product) : null}/></State></section>
    {modal && <Modal title={modal.type === 'delete' ? 'Eliminar producto' : modal.type === 'stock' ? 'Actualizar stock' : p.id ? 'Editar producto' : 'Nuevo producto'} onClose={() => setModal(null)} busy={busy}><form onSubmit={save}><fieldset disabled={busy}><Notice>{formError}</Notice>{modal.type === 'delete' ? <p>¿Eliminar <strong>{p.name}</strong> de {p.store_name}? La auditoría se conservará. Esta acción no se puede deshacer.</p> : modal.type === 'stock' ? <><p>{p.name} · {p.store_name}</p><div className="info-box">Stock actual: <strong>{p.stock}</strong></div><Field label="Nueva cantidad"><input name="stock" type="number" min="0" max="2147483647" step="1" defaultValue={p.stock} required autoFocus/></Field><p className="helper">Establece la cantidad total disponible.</p></> : <div className="form-grid"><Field label="Nombre del producto" className="span-2"><input name="name" defaultValue={p.name} maxLength={150} required autoFocus/></Field><Field label="SKU"><input name="sku" defaultValue={p.sku} maxLength={60} required/></Field><Field label="Categoría"><input name="category" defaultValue={p.category} maxLength={80} required/></Field>{user.role === 'admin' && <Field label="Tienda" className="span-2"><select name="store" defaultValue={p.store || ''} required><option value="">Selecciona una tienda</option>{stores?.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>}<Field label="Precio (S/)" className="span-2"><input name="price" type="number" step="0.01" min="0" max="9999999999.99" defaultValue={p.price ?? '0.00'} required/></Field><Field label="Stock"><input name="stock" type="number" step="1" min="0" max="2147483647" defaultValue={p.stock ?? 0} required/></Field><Field label="Stock mínimo"><input name="minimum_stock" type="number" step="1" min="0" max="2147483647" defaultValue={p.minimum_stock ?? 5} required/></Field><Field label="URL de imagen (opcional)" className="span-2"><input name="image_url" type="url" pattern="https?://.*" defaultValue={p.image_url} maxLength={1000} placeholder="https://…"/></Field><Field label="Descripción" className="span-2"><textarea name="description" defaultValue={p.description} rows={3} maxLength={2000}/></Field></div>}<div className="modal-actions"><button className="secondary" type="button" onClick={() => setModal(null)}>Cancelar</button><button className={modal.type === 'delete' ? 'danger-button' : 'primary'}>{busy ? 'Guardando…' : modal.type === 'delete' ? 'Eliminar producto' : 'Guardar cambios'}</button></div></fieldset></form></Modal>}
  </>
}

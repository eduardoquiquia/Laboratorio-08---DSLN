import { Field, Icon } from './UI'

export default function Filters({ filters, setFilters, stores, global }) {
  const change = (name, value) => setFilters({ ...filters, [name]: value })
  return <div className="filters"><label className="search-field"><Icon name="search"/><input aria-label="Buscar por nombre o SKU" placeholder="Buscar producto o SKU…" value={filters.search} onChange={e => change('search', e.target.value)}/></label>{global && <Field label="Tienda"><select value={filters.store} onChange={e => change('store', e.target.value)}><option value="">Todas las tiendas</option>{stores?.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field>}<Field label="Categoría"><input aria-label="Filtrar categoría exacta" placeholder="Todas las categorías" value={filters.category} onChange={e => change('category', e.target.value)}/></Field><label className="checkbox"><input type="checkbox" checked={filters.low_stock === 'true'} onChange={e => change('low_stock', e.target.checked ? 'true' : '')}/> Solo stock bajo</label></div>
}

import { useAuth } from '../context/AuthContext'
import useData from '../lib/useData'
import { PageTitle, Icon, State } from '../components/UI'
import ProductTable from '../components/ProductTable'

export default function Dashboard({ navigate }) {
  const { user } = useAuth()
  const { data, loading, error } = useData('/dashboard/')
  return <><PageTitle eyebrow="UN VISTAZO A TU OPERACIÓN" title={`Hola, ${user.full_name.split(' ')[0]} 👋`} description="Tu inventario al día. Todo lo que necesitas saber, en un solo lugar." action={<button className="secondary" onClick={() => navigate('inventory')}>Ver inventario <Icon name="arrow" size={17}/></button>}/><State loading={loading} error={error}>{data && <>
    <div className="summary-grid">{[['Productos', data.products, 'box', 'Referencias en tu alcance'], ['Unidades en stock', data.units, 'grid', 'Disponibles en inventario'], ['Alertas de stock', data.low_stock, 'alert', 'Productos por reponer'], ['Tiendas', data.stores, 'store', 'Dentro de tu alcance']].map(([label, value, icon, hint]) => <div className={`summary-card ${icon === 'alert' ? 'alert-card' : ''}`} key={label}><div className="summary-top"><span>{label}</span><span className="metric-icon"><Icon name={icon}/></span></div><strong>{value}</strong><small>{hint}</small></div>)}</div>
    <section className="welcome-banner"><div className="banner-icon"><Icon name="shield" size={36}/></div><div><h2>Un equipo conectado. Un inventario protegido.</h2><p>Tu acceso está verificado. Cada operación respeta los permisos de tu perfil.</p></div><span className="badge success"><Icon name="check" size={14}/> MFA activo</span></section>
    <section className="panel"><div className="panel-heading"><div><h2><Icon name="alert"/> Atención al stock</h2><p>Productos en el mínimo o por debajo de él.</p></div><span className="badge warning">{data.low_stock} alertas</span></div><State empty={!data.alerts.length}><ProductTable products={data.alerts}/></State>{data.low_stock > 8 && <div className="panel-footer"><button className="text-button" onClick={() => navigate('inventory')}>Ver todas las alertas <Icon name="arrow" size={16}/></button></div>}</section>
    <div className="scope-note"><Icon name="store" size={16}/>{user.store_name || 'Todas las tiendas'}<span>Los datos se actualizan desde tu inventario.</span></div>
  </>}</State></>
}

import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import useData from '../lib/useData'
import { PageTitle, Icon, State, Modal, Field, Notice, RoleBadge } from '../components/UI'
import { roles } from '../lib/roles'

export default function Management({ resource }) {
  const { user } = useAuth()
  const users = resource === 'users'
  const admin = user.role === 'admin'
  const [revision, setRevision] = useState(0)
  const { data, loading, error } = useData(`/${resource}/`, revision)
  const { data: stores } = useData('/stores/', revision)
  const [modal, setModal] = useState(null)
  const [role, setRole] = useState('employee')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState('')
  const open = (type, item = {}) => { setModal({ type, item }); setRole(item.role || 'employee'); setFormError('') }
  async function save(event) {
    event.preventDefault()
    if (busy) return
    const body = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true); setFormError(''); setMessage('')
    try {
      if (modal.type === 'delete') await api(`/${resource}/${modal.item.id}/`, { method: 'DELETE' })
      else {
        if (users) {
          body.store = body.store ? Number(body.store) : null
          body.is_active = body.is_active === 'true'
          if (!body.password) delete body.password
        }
        await api(modal.item.id ? `/${resource}/${modal.item.id}/` : `/${resource}/`, { method: modal.item.id ? 'PATCH' : 'POST', body })
      }
      setModal(null); setRevision(value => value + 1); setMessage('¡Cambios guardados correctamente!')
    } catch (e) { setFormError(e.message) } finally { setBusy(false) }
  }
  const item = modal?.item
  return <><PageTitle title={users ? 'Usuarios' : 'Tiendas'} description={users ? 'Las personas detrás de cada operación y sus permisos.' : 'Los espacios que conectan tu inventario.'} action={admin && <button className="primary" onClick={() => open('edit')}><Icon name="plus" size={18}/>{users ? 'Crear usuario' : 'Agregar tienda'}</button>}/>{!admin && <div className="read-only"><Icon name="shield" size={16}/> Tu perfil de auditor tiene acceso de solo lectura.</div>}<Notice type="success">{message}</Notice><section className="panel"><div className="panel-heading"><h2>{users ? 'Equipo TechStore' : 'Red de tiendas'}</h2><span className="muted">{data?.length ?? '…'} registros</span></div><State loading={loading} error={error} empty={!data?.length}><div className="table-scroll"><table><thead><tr>{users ? <><th>Usuario</th><th>Rol</th><th>Tienda</th><th>Estado</th><th>Verificación</th></> : <><th>Tienda</th><th>Dirección</th></>}{admin && <th className="align-right">Acciones</th>}</tr></thead><tbody>{data?.map(row => <tr key={row.id}>{users ? <><td><div className="person-cell"><span className="avatar">{row.full_name.slice(0, 1)}</span><div><strong>{row.full_name}</strong><small>{row.email}</small></div></div></td><td><RoleBadge role={row.role}/></td><td>{row.store_name}</td><td><span className={`badge ${row.is_active ? 'success' : 'neutral'}`}>{row.is_active ? 'Activo' : 'Inactivo'}</span></td><td><div className="verification-cell"><span>{row.email_verified ? '✓ Correo verificado' : '○ Correo pendiente'}</span><span>{row.mfa_enabled ? '✓ MFA activo' : '○ MFA pendiente'}</span></div></td></> : <><td><div className="person-cell"><span className="store-icon"><Icon name="store"/></span><strong>{row.name}</strong></div></td><td>{row.address || 'Sin dirección'}</td></>}{admin && <td><div className="row-actions"><button className="secondary small" onClick={() => open('edit', row)}><Icon name="edit" size={15}/> Editar</button>{!users && <button className="icon-button danger" aria-label={`Eliminar ${row.name}`} onClick={() => open('delete', row)}><Icon name="trash" size={17}/></button>}</div></td>}</tr>)}</tbody></table></div></State></section>
  {modal && <Modal title={modal.type === 'delete' ? 'Eliminar tienda' : `${item.id ? 'Editar' : 'Crear'} ${users ? 'usuario' : 'tienda'}`} onClose={() => setModal(null)} busy={busy}><form onSubmit={save}><fieldset disabled={busy}><Notice>{formError}</Notice>{modal.type === 'delete' ? <p>¿Eliminar <strong>{item.name}</strong>? Solo puedes eliminar una tienda sin usuarios ni productos asociados.</p> : users ? <div className="form-grid"><Field label="Nombre completo" className="span-2"><input name="full_name" defaultValue={item.full_name} maxLength={150} required autoFocus/></Field><Field label="Correo electrónico" className="span-2"><input name="email" type="email" defaultValue={item.email} maxLength={254} required/></Field><Field label="Rol"><select name="role" value={role} onChange={e => setRole(e.target.value)}>{Object.entries(roles).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Estado"><select name="is_active" defaultValue={item.is_active === false ? 'false' : 'true'}><option value="true">Activo</option><option value="false">Inactivo</option></select></Field><Field label="Tienda" className="span-2"><select name="store" defaultValue={item.store || ''} required={['manager', 'employee'].includes(role)}><option value="">Sin asignar · alcance global</option>{stores?.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></Field><Field label={item.id ? 'Nueva contraseña (deja vacío para conservar)' : 'Contraseña inicial'} className="span-2"><input name="password" type="password" minLength={8} maxLength={128} pattern="(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9_\s]).{8,}" title="Al menos 8 caracteres, una mayúscula, un número y un carácter especial" required={!item.id} autoComplete="new-password"/></Field><p className="helper span-2">Al menos 8 caracteres, una mayúscula, un número y un carácter especial. Cada usuario verificará su correo y configurará MFA al ingresar.</p>{item.id && <p className="helper span-2">Cambiar correo, contraseña, rol, tienda o estado cierra las sesiones existentes.</p>}</div> : <><Field label="Nombre de la tienda"><input name="name" defaultValue={item.name} maxLength={100} required autoFocus/></Field><Field label="Dirección"><input name="address" defaultValue={item.address} maxLength={250}/></Field></>}<div className="modal-actions"><button className="secondary" type="button" onClick={() => setModal(null)}>Cancelar</button><button className={modal.type === 'delete' ? 'danger-button' : 'primary'}>{busy ? 'Guardando…' : modal.type === 'delete' ? 'Eliminar tienda' : 'Guardar cambios'}</button></div></fieldset></form></Modal>}</>
}

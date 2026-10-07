import { useEffect, useState } from 'react'
import { API, api } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { Brand, Icon, Notice, Field } from '../components/UI'

const initialParams = new URLSearchParams(window.location.search)

export default function Login() {
  const { setUser, error: sessionError } = useAuth()
  const [stage, setStage] = useState(initialParams.has('verify') ? 'verify' : 'login')
  const [error, setError] = useState(initialParams.get('oauth_error') || sessionError)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [enrollment, setEnrollment] = useState(null)
  const [email, setEmail] = useState('')
  const [expires, setExpires] = useState(null)
  const [lockedUntil, setLockedUntil] = useState(null)
  const [resendUntil, setResendUntil] = useState(0)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    if (initialParams.has('verify')) return
    let active = true
    api('/auth/partial/').then(data => {
      if (active && data.stage !== 'login') { setStage(data.stage); setExpires(data.expires_at); setEmail(data.email) }
    }).catch(e => { if (active) { setError(e.message); setLockedUntil(e.data?.locked_until) } })
    window.history.replaceState({}, '', '/')
    return () => { active = false }
  }, [])
  const remaining = lockedUntil ? Math.max(0, Math.ceil((new Date(lockedUntil) - now) / 1000)) : 0
  const partialRemaining = expires ? Math.max(0, Math.ceil((new Date(expires) - now) / 1000)) : null
  const countdown = value => `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
  async function run(action) {
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try { await action() } catch (e) {
      setError(e.message)
      if (e.data?.locked_until) { setLockedUntil(e.data.locked_until); setStage('login'); setEnrollment(null) }
      if (e.data?.restart) { setStage('login'); setEnrollment(null) }
    } finally { setBusy(false) }
  }
  function setPartial(data) { setStage(data.stage); setExpires(data.expires_at); setEmail(data.email) }
  const login = event => {
    event.preventDefault()
    const values = Object.fromEntries(new FormData(event.currentTarget))
    run(async () => setPartial(await api('/auth/login/', { method: 'POST', body: values })))
  }
  const verifyTOTP = event => {
    event.preventDefault()
    const code = new FormData(event.currentTarget).get('code')
    run(async () => {
      const data = await api('/auth/mfa/verify/', { method: 'POST', body: { code } })
      setEnrollment(null); setUser(data.user)
    })
  }
  const back = () => run(async () => {
    await api('/auth/logout/', { method: 'POST' }); setStage('login'); setEnrollment(null); setExpires(null)
    initialParams.delete('verify'); window.history.replaceState({}, '', '/')
  })
  const step = ['login', 'email', 'enroll', 'totp', 'verify'].includes(stage) ? (stage === 'login' ? 1 : ['email', 'verify'].includes(stage) ? 2 : 3) : 1
  return <div className="auth-layout">
    <aside className="auth-story"><Brand/><div className="story-content"><span className="tag"><span className="status-dot"/> CONTROL QUE TE ACOMPAÑA</span><h1>Todo tu inventario.<br/><span>En buenas manos.</span></h1><p>Un espacio para conectar tus tiendas, cuidar cada producto y trabajar con tranquilidad.</p>
      <div className="inventory-art" aria-hidden="true"><div className="art-orbit"/><div className="art-box"><Icon name="box" size={98}/></div><div className="art-label"><Icon name="shield"/><div>Acceso protegido<small>Verificación en dos pasos</small></div><span className="art-check">✓</span></div><div className="art-mini"><Icon name="store"/> Cada tienda, su espacio</div></div>
    </div><div className="story-footer"><Icon name="lock" size={15}/> Seguridad en cada operación <span>TechStore · 2026</span></div></aside>
    <main className="auth-main"><div className="auth-card"><div className="steps">{['Identidad', 'Correo', 'Autenticador'].map((label, index) => <div className={step >= index + 1 ? 'active' : ''} key={label}><b>{step > index + 1 ? '✓' : index + 1}</b>{label}</div>)}</div>
      <div className="auth-symbol"><Icon name={step === 3 ? 'shield' : 'lock'} size={26}/></div>
      <h2>{({ login: 'Bienvenido de nuevo', email: 'Verifica tu correo', verify: 'Confirma tu correo', enroll: 'Un paso más seguro', totp: 'Confirma que eres tú' })[stage]}</h2>
      <p className="auth-subtitle">{stage === 'login' ? 'Ingresa a tu espacio de trabajo en TechStore.' : stage === 'email' ? `Continuemos con ${email}.` : stage === 'verify' ? 'Confirma el enlace para verificar tu dirección.' : 'Completa el acceso con Google Authenticator.'}</p>
      <Notice>{error}</Notice><Notice type="success">{message}</Notice>
      {remaining > 0 && <Notice>Cuenta bloqueada. Tiempo restante: {countdown(remaining)}.</Notice>}
      {stage === 'login' && <><form onSubmit={login}><fieldset disabled={busy || remaining > 0}><Field label="Correo electrónico"><input name="email" type="email" placeholder="nombre@empresa.com" required autoComplete="username" maxLength={254}/></Field><Field label="Contraseña"><input name="password" type="password" placeholder="Tu contraseña" required autoComplete="current-password" maxLength={128}/></Field><button className="primary full" type="submit">{busy ? 'Validando…' : 'Continuar'}<Icon name="arrow"/></button></fieldset></form><div className="divider">o continúa con</div><div className="social-buttons"><a className={remaining > 0 ? 'disabled' : ''} href={`${API}/auth/oauth/google/`}><b className="google-mark">G</b> Google</a><a className={remaining > 0 ? 'disabled' : ''} href={`${API}/auth/oauth/github/`}><svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.69-.1-.26-.45-1.28.1-2.66 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.93c.85 0 1.71.11 2.51.34 1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.66.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.63c0 .27.18.58.69.48A10 10 0 0 0 12 2Z"/></svg> GitHub</a></div><p className="auth-note">¿Necesitas una cuenta? Contacta con tu administrador.</p></>}
      {stage === 'email' && <><div className="info-box"><Icon name="report"/><p>En esta demostración local, el enlace aparecerá en la terminal de Django. Tiene una validez de 30 minutos y solo puede usarse una vez.</p></div><button className="primary full" disabled={busy || resendUntil > now || partialRemaining === 0} onClick={() => run(async () => { const data = await api('/auth/email/send/', { method: 'POST' }); setMessage(data.detail); setResendUntil(Date.now() + 60000) })}>{resendUntil > now ? `Reenviar en ${Math.ceil((resendUntil - now) / 1000)} s` : 'Generar enlace de verificación'}</button><button className="secondary full" disabled={busy || partialRemaining === 0} onClick={() => run(async () => { const data = await api('/auth/partial/'); if (data.stage === 'login') { setStage('login'); setMessage('Inicia sesión para continuar después de verificar el correo.') } else setPartial(data) })}>Ya verifiqué mi correo</button></>}
      {stage === 'verify' && <button className="primary full" disabled={busy || !!message} onClick={() => run(async () => { const data = await api('/auth/email/verify/', { method: 'POST', body: { token: initialParams.get('verify') } }); setMessage(data.detail); setStage('login'); initialParams.delete('verify'); window.history.replaceState({}, '', '/') })}>{busy ? 'Verificando…' : 'Confirmar correo electrónico'}</button>}
      {stage === 'enroll' && <>{!enrollment ? <><div className="info-box"><p>1. Abre Google Authenticator.<br/>2. Agrega una cuenta escaneando el QR.<br/>3. Confirma el código de seis dígitos.</p></div><button className="secondary full" disabled={busy || partialRemaining === 0} onClick={() => run(async () => setEnrollment(await api('/auth/mfa/enroll/', { method: 'POST' })))}>Mostrar mi QR de configuración</button></> : <div className="qr-panel"><img src={enrollment.qr} alt="QR para configurar tu cuenta en Google Authenticator"/><details><summary>Introducir clave manualmente</summary><code>{enrollment.secret}</code><small>Tipo: basado en tiempo (TOTP), 30 segundos.</small></details></div>}</>}
      {(stage === 'totp' || (stage === 'enroll' && enrollment)) && <form onSubmit={verifyTOTP}><fieldset disabled={busy || partialRemaining === 0}><Field label="Código de Google Authenticator"><input className="otp-input" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} minLength={6} placeholder="000000" autoComplete="one-time-code" required/></Field><p className="helper">El código cambia cada 30 segundos. No reutilices uno ya aceptado.</p><button className="primary full">{busy ? 'Verificando…' : stage === 'enroll' ? 'Activar MFA y entrar' : 'Verificar y entrar'}<Icon name="arrow"/></button></fieldset></form>}
      {stage !== 'login' && <><button className="text-button full" disabled={busy} onClick={back}>Volver al inicio de sesión</button>{partialRemaining !== null && stage !== 'verify' && <p className="auth-note">{partialRemaining > 0 ? `Proceso disponible durante ${countdown(partialRemaining)}` : 'El proceso venció. Vuelve a iniciar sesión.'}</p>}</>}
    </div><p className="secure-footer"><Icon name="shield" size={15}/> Acceso autorizado · Verificación MFA obligatoria</p></main>
  </div>
}

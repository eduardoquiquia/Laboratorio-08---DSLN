export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
let csrfToken = ''
let csrfRequest

export async function csrf() {
  if (!csrfRequest) {
    csrfRequest = fetch(`${API}/auth/csrf/`, { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error('No se pudo preparar la conexión segura.')
        csrfToken = (await response.json()).csrfToken
      }).finally(() => { csrfRequest = null })
  }
  return csrfRequest
}

function errorMessage(data) {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(errorMessage).join(' ')
  if (data?.detail) return errorMessage(data.detail)
  return Object.entries(data || {}).map(([key, value]) => `${key}: ${errorMessage(value)}`).join(' · ')
}

export async function api(path, { method = 'GET', body, blob = false, signal } = {}) {
  if (method !== 'GET' && !csrfToken) await csrf()
  let response
  try {
    response = await fetch(`${API}${path}`, {
      method, credentials: 'include', signal,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-CSRFToken': csrfToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('No se pudo conectar con Django. Comprueba que esté iniciado en localhost:8000.', { cause: error })
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    const error = new Error(errorMessage(data) || `No se pudo completar la solicitud (${response.status}).`)
    error.status = response.status
    error.data = data
    if (response.status === 401 && path !== '/auth/me/') window.dispatchEvent(new Event('session-expired'))
    throw error
  }
  if (blob) return response.blob()
  const data = response.status === 204 ? null : await response.json()
  if (data?.csrfToken) csrfToken = data.csrfToken
  return data
}

export function query(values) {
  return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null)).toString()
}

export async function download(path, filename) {
  const data = await api(path, { blob: true })
  const url = URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

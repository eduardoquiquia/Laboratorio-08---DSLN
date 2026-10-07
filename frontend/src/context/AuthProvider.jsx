import { useEffect, useState } from 'react'
import { api, csrf } from '../lib/api'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!user?.session_expires_at) return
    const timer = setTimeout(() => {
      setUser(null)
      setError('La sesión de 8 horas terminó. Inicia sesión de nuevo.')
    }, Math.max(0, new Date(user.session_expires_at) - Date.now()))
    return () => clearTimeout(timer)
  }, [user?.session_expires_at])
  useEffect(() => {
    let active = true
    async function restore() {
      try {
        await csrf()
        const data = await api('/auth/me/')
        if (active) setUser(data)
      } catch (e) {
        if (active && e.status !== 401) setError(e.message)
      } finally { if (active) setLoading(false) }
    }
    restore()
    const expired = () => { setUser(null); setError('La sesión terminó. Inicia sesión de nuevo.') }
    window.addEventListener('session-expired', expired)
    return () => { active = false; window.removeEventListener('session-expired', expired) }
  }, [])
  async function logout() {
    await api('/auth/logout/', { method: 'POST' })
    setUser(null)
    setError('')
  }
  return <AuthContext.Provider value={{ user, setUser, loading, error, logout }}>{children}</AuthContext.Provider>
}

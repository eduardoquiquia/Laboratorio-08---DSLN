import { useEffect, useState } from 'react'
import { api } from './api'

export default function useData(path, revision = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  useEffect(() => {
    const controller = new AbortController()
    // Una petición nueva reemplaza los resultados anteriores y no conserva filas obsoletas.
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setState({ data: null, loading: true, error: '' })
    })
    api(path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' })
    }).catch(error => {
      if (!controller.signal.aborted) setState({ data: null, loading: false, error: error.message })
    })
    return () => controller.abort()
  }, [path, revision])
  return state
}

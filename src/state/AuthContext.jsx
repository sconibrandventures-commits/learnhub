import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import backend from '../lib/backend'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    backend
      .getSession()
      .then((u) => { if (alive) setUser(u) })
      .catch(() => { if (alive) setUser(null) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    const u = await backend.login(email, password)
    setUser(u)
    return u
  }, [])

  const register = useCallback(async (payload) => {
    setError(null)
    const u = await backend.register(payload)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await backend.logout()
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    const u = await backend.getSession()
    setUser(u)
    return u
  }, [])

  const value = useMemo(() => {
    const role = user?.role || 'guest'
    return {
      user, loading, error, setError,
      isAuthed: !!user,
      isAdmin: role === 'admin',
      isInstructor: role === 'instructor',
      isStudent: role === 'student',
      canManageCourse: role === 'admin' || role === 'instructor',
      login, register, logout, refresh,
    }
  }, [user, loading, error, login, register, logout, refresh])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Where to send someone after they sign in. */
export function homeFor(role) {
  if (role === 'admin') return '/admin'
  if (role === 'instructor') return '/instructor'
  return '/student'
}

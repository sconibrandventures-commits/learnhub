import { useState, useEffect, useCallback } from 'react'

/**
 * Tiny data-fetching hook.
 *   const { data, loading, error, reload } = useAsync(() => backend.listCourses(), [deps])
 */
export function useAsync(fn, deps = [], { skip = false } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(!skip)
  const [error, setError] = useState(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  useEffect(() => {
    if (skip) return
    let alive = true
    setLoading(true)
    setError(null)
    Promise.resolve()
      .then(fn)
      .then((result) => { if (alive) { setData(result); setLoading(false) } })
      .catch((err) => { if (alive) { setError(err); setLoading(false) } })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, skip])

  return { data, loading, error, reload, setData }
}

/** Poll every `ms` milliseconds — used for live class state and chat. */
export function useInterval(callback, ms) {
  useEffect(() => {
    if (!ms) return
    const id = setInterval(callback, ms)
    return () => clearInterval(id)
  }, [callback, ms])
}

/** Re-render on a timer so countdowns stay fresh. */
export function useTicker(ms = 30000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

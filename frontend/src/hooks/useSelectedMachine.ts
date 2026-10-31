import { useCallback, useSyncExternalStore } from 'react'

const KEY = 'traceback.selectedMachine'
const listeners = new Set<() => void>()

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Last machine the user investigated. Session-scoped, non-sensitive; used so sidebar/Copilot keep context. */
export function useSelectedMachine() {
  const id = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => null,
  )
  const set = useCallback((next: string | null) => {
    try {
      if (next) sessionStorage.setItem(KEY, next)
      else sessionStorage.removeItem(KEY)
    } catch {
      /* storage unavailable — context just isn't remembered */
    }
    listeners.forEach((l) => l())
  }, [])
  return [id, set] as const
}

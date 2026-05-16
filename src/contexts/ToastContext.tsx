import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type ToastRecord = {
  id: string
  title: string
  message: string
  exiting: boolean
}

type ToastTimers = { display: ReturnType<typeof setTimeout>; exit: ReturnType<typeof setTimeout> | 0 }

type ToastContextType = {
  toasts: ToastRecord[]
  pushToast: (title: string, message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const MAX_TOASTS = 2
const DISPLAY_MS = 3000
const EXIT_MS = 200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([])
  const timersRef = useRef<Map<string, ToastTimers>>(new Map())

  const removeTimer = useCallback((id: string) => {
    const t = timersRef.current.get(id)
    if (t) {
      window.clearTimeout(t.display)
      if (t.exit) window.clearTimeout(t.exit)
      timersRef.current.delete(id)
    }
  }, [])

  const dismissToast = useCallback(
    (id: string) => {
      removeTimer(id)
      setToasts((prev) => prev.filter((x) => x.id !== id))
    },
    [removeTimer],
  )

  const startExit = useCallback(
    (id: string) => {
      setToasts((prev) => prev.map((x) => (x.id === id ? { ...x, exiting: true } : x)))
      const exitTimer = window.setTimeout(() => {
        dismissToast(id)
      }, EXIT_MS)
      const existing = timersRef.current.get(id)
      if (existing?.exit) window.clearTimeout(existing.exit)
      timersRef.current.set(id, {
        display: existing?.display ?? 0,
        exit: exitTimer,
      })
    },
    [dismissToast],
  )

  const pushToast = useCallback(
    (title: string, message: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      setToasts((prev) => {
        let base = prev
        if (prev.length >= MAX_TOASTS) {
          const dropId = prev[0].id
          removeTimer(dropId)
          base = prev.slice(1)
        }
        return [...base, { id, title, message, exiting: false }]
      })
      const displayTimer = window.setTimeout(() => {
        startExit(id)
      }, DISPLAY_MS)
      timersRef.current.set(id, { display: displayTimer, exit: 0 })
    },
    [startExit, removeTimer],
  )

  const value = useMemo(
    () => ({
      toasts,
      pushToast,
    }),
    [toasts, pushToast],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

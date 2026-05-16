import { useEffect, useState } from "react"
import { cn } from "../lib/utils"
import { useToast } from "../contexts/ToastContext"

function ToastCard({
  title,
  message,
  exiting,
}: {
  title: string
  message: string
  exiting: boolean
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <div
      role="status"
      className={cn(
        "max-w-sm rounded-lg border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-lg transition-all duration-200",
        exiting || !entered ? "translate-x-4 opacity-0" : "translate-x-0 opacity-100",
      )}
    >
      <div className="font-semibold text-sm">{title}</div>
      <div className="mt-1 text-xs text-gray-500">{message}</div>
    </div>
  )
}

export default function ToastContainer() {
  const { toasts } = useToast()

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-[120] flex max-w-[100vw] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard title={t.title} message={t.message} exiting={t.exiting} />
        </div>
      ))}
    </div>
  )
}

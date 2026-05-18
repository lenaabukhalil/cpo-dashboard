import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, CreditCard, UserPlus } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export interface AddUserDropdownProps {
  label: string
  partnerLabel: string
  partnerDescription: string
  rfidLabel: string
  rfidDescription: string
  showPartner: boolean
  showRfid: boolean
  onAddPartner: () => void
  onAddRfid: () => void
}

/**
 * "Add user" trigger with a small menu for Partner vs RFID creation flows.
 */
export function AddUserDropdown({
  label,
  partnerLabel,
  partnerDescription,
  rfidLabel,
  rfidDescription,
  showPartner,
  showRfid,
  onAddPartner,
  onAddRfid,
}: AddUserDropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const [activeIndex, setActiveIndex] = useState(0)

  const options = [
    ...(showPartner ? [{ id: 'partner' as const, onSelect: onAddPartner }] : []),
    ...(showRfid ? [{ id: 'rfid' as const, onSelect: onAddRfid }] : []),
  ]

  const close = useCallback(() => {
    setOpen(false)
    setActiveIndex(0)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (options.length === 0) return
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % options.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + options.length) % options.length)
      } else if (e.key === 'Enter' && document.activeElement?.getAttribute('role') === 'menuitem') {
        e.preventDefault()
        options[activeIndex]?.onSelect()
        close()
      }
    }
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, close, options, activeIndex])

  const selectOption = (index: number) => {
    options[index]?.onSelect()
    close()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="gap-1"
      >
        <UserPlus className="h-4 w-4 rtl:ml-0" />
        <span>{label}</span>
        <ChevronDown className={cn('h-4 w-4 opacity-70 transition-transform', open && 'rotate-180')} />
      </Button>
      {open && options.length > 0 ? (
        <div
          id={menuId}
          role="menu"
          className="absolute end-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-card p-1 shadow-lg"
        >
          {showPartner ? (
            <button
              type="button"
              role="menuitem"
              tabIndex={activeIndex === 0 ? 0 : -1}
              className={cn(
                'flex w-full gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-muted/60 focus:outline-none focus:bg-muted/60',
                activeIndex === 0 && 'bg-muted/40',
              )}
              onClick={() => selectOption(0)}
              onFocus={() => setActiveIndex(0)}
            >
              <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium text-foreground">{partnerLabel}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{partnerDescription}</span>
              </span>
            </button>
          ) : null}
          {showRfid ? (
            <button
              type="button"
              role="menuitem"
              tabIndex={activeIndex === (showPartner ? 1 : 0) ? 0 : -1}
              className={cn(
                'flex w-full gap-3 rounded-lg px-3 py-2.5 text-start transition-colors hover:bg-muted/60 focus:outline-none focus:bg-muted/60',
                activeIndex === (showPartner ? 1 : 0) && 'bg-muted/40',
              )}
              onClick={() => selectOption(showPartner ? 1 : 0)}
              onFocus={() => setActiveIndex(showPartner ? 1 : 0)}
            >
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <span>
                <span className="block text-sm font-medium text-foreground">{rfidLabel}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{rfidDescription}</span>
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

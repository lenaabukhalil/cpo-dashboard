import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronDown, Check } from "lucide-react";
import type { AppSelectOption } from "./AppSelect";
import { cn } from "../../lib/utils";

export interface AppMultiSelectProps {
  options: AppSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}

const controlMinHeight = 40;
const controlMinHeightSm = 36;

export function AppMultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  isDisabled = false,
  className = "",
  size = "default",
}: AppMultiSelectProps) {
  const controlRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const minHeight = size === "sm" ? controlMinHeightSm : controlMinHeight;

  const openMenu = useCallback(() => {
    if (isDisabled) return;
    const el = controlRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuRect({
      top: rect.bottom,
      left: rect.left,
      width: Math.max(rect.width, 180),
    });
    setIsOpen(true);
  }, [isDisabled]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setMenuRect(null);
  }, []);

  const toggleOption = useCallback(
    (optValue: string) => {
      const set = new Set(value);
      if (set.has(optValue)) set.delete(optValue);
      else set.add(optValue);
      onChange(Array.from(set));
    },
    [value, onChange]
  );

  const removeOption = useCallback(
    (e: React.MouseEvent, optValue: string) => {
      e.stopPropagation();
      onChange(value.filter((v) => v !== optValue));
    },
    [value, onChange]
  );

  const clearAll = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange([]);
    },
    [onChange]
  );

  // Click outside: close when mousedown is outside control and menu
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (controlRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, closeMenu]);

  // Escape: close menu
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeMenu]);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const dropdownContent =
    isOpen && menuRect && typeof document !== "undefined" ? (
      <div
        ref={menuRef}
        className="bg-popover border border-border rounded-md shadow-lg py-1 min-w-[180px] max-h-[280px] overflow-y-auto"
        style={{
          position: "fixed",
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          zIndex: 9999,
          transform: "translateY(2px)",
        }}
        role="listbox"
      >
        {options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">No options</div>
        ) : (
          options.map((opt) => {
            const selected = value.includes(opt.value);
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                  selected
                    ? "bg-primary/15 text-foreground"
                    : "hover:bg-accent hover:text-accent-foreground text-foreground"
                )}
                onClick={() => toggleOption(opt.value)}
              >
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <span className="w-4 shrink-0" />}
                <span className="truncate">{opt.label}</span>
              </div>
            );
          })
        )}
      </div>
    ) : null;

  return (
    <div className={cn(className)}>
      <div
        ref={controlRef}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-disabled={isDisabled}
        className={cn(
          "flex items-center flex-wrap gap-2 rounded-md border bg-background px-3 py-2 cursor-pointer transition-colors",
          "border-input hover:border-input focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0",
          isDisabled && "pointer-events-none opacity-60",
          isOpen && "ring-2 ring-ring ring-offset-0 border-ring"
        )}
        style={{ minHeight: `${minHeight}px` }}
        onClick={openMenu}
      >
        {selectedOptions.length === 0 ? (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        ) : (
          <>
            {selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium border border-primary/20 max-w-[140px] truncate"
              >
                <span className="truncate min-w-0">{opt.label}</span>
                <button
                  type="button"
                  aria-label="Remove"
                  className="shrink-0 rounded p-0.5 hover:bg-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={(e) => removeOption(e, opt.value)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="inline-flex items-center gap-0.5 ml-auto shrink-0">
              <button
                type="button"
                aria-label="Clear all"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={clearAll}
              >
                <X className="h-4 w-4" />
              </button>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground", isOpen && "rotate-180")} aria-hidden />
            </span>
          </>
        )}
        {selectedOptions.length === 0 && (
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground ml-auto", isOpen && "rotate-180")} aria-hidden />
        )}
      </div>

      {dropdownContent && createPortal(dropdownContent, document.body)}
    </div>
  );
}

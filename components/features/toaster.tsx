"use client"

import { useEffect, useReducer, useRef } from "react"
import { CheckCircle, XCircle, X, Info } from "lucide-react"

import { TOAST_EVENT, DISMISS_EVENT, type ToastMessage, type ToastVariant } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "add"; toast: ToastMessage }
  | { type: "dismiss"; id: string }

function reducer(state: ToastMessage[], action: Action): ToastMessage[] {
  switch (action.type) {
    case "add":
      // Limit to 5 toasts at once
      return [...state.slice(-4), action.toast]
    case "dismiss":
      return state.filter((t) => t.id !== action.id)
  }
}

// ─── Toast item component ─────────────────────────────────────────────────────

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-card border-border text-foreground",
  success: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100",
  error: "bg-red-50 border-red-200 text-red-900 dark:bg-red-950/50 dark:border-red-800 dark:text-red-100",
}

const variantIcons: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle,
  error: XCircle,
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage
  onDismiss: (id: string) => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const variant = toast.variant ?? "default"
  const Icon = variantIcons[variant]

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      timerRef.current = setTimeout(() => onDismiss(toast.id), toast.duration)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-lg transition-all",
        variantStyles[variant]
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-xs opacity-80">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Toaster (mount once in root layout) ─────────────────────────────────────

/**
 * Mount this once in the root layout. It listens for `havenflow:toast` events
 * dispatched by the `toast()` helper and renders stacked notifications.
 */
export function Toaster() {
  const [toasts, dispatch] = useReducer(reducer, [])

  useEffect(() => {
    function onAdd(e: Event) {
      const toast = (e as CustomEvent<ToastMessage>).detail
      dispatch({ type: "add", toast })
    }
    function onDismiss(e: Event) {
      const { id } = (e as CustomEvent<{ id: string }>).detail
      dispatch({ type: "dismiss", id })
    }

    window.addEventListener(TOAST_EVENT, onAdd)
    window.addEventListener(DISMISS_EVENT, onDismiss)
    return () => {
      window.removeEventListener(TOAST_EVENT, onAdd)
      window.removeEventListener(DISMISS_EVENT, onDismiss)
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-20 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 md:bottom-4 md:right-4 md:left-auto md:translate-x-0 md:px-0"
    >
      {toasts.map((t) => (
        <ToastItem
          key={t.id}
          toast={t}
          onDismiss={(id) => dispatch({ type: "dismiss", id })}
        />
      ))}
    </div>
  )
}

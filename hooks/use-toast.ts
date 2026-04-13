/**
 * Minimal custom-events-based toast system.
 *
 * Usage (anywhere, including Server Action callbacks):
 *   import { toast } from "@/hooks/use-toast"
 *   toast("Item saved!")
 *   toast("Something went wrong", { variant: "error" })
 */

export type ToastVariant = "default" | "success" | "error"

export interface ToastMessage {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  /** Auto-dismiss duration in ms (default 4000, 0 = never) */
  duration?: number
}

const TOAST_EVENT = "havenflow:toast" as const
const DISMISS_EVENT = "havenflow:toast:dismiss" as const

/** Dispatch a toast notification. Safe to call from any client-side code. */
export function toast(
  title: string,
  opts?: Omit<ToastMessage, "id" | "title">
): void {
  if (typeof window === "undefined") return
  const message: ToastMessage = {
    id: Math.random().toString(36).slice(2),
    title,
    duration: 4000,
    ...opts,
  }
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }))
}

/** Dismiss a toast by id. */
export function dismissToast(id: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(DISMISS_EVENT, { detail: { id } }))
}

export { TOAST_EVENT, DISMISS_EVENT }

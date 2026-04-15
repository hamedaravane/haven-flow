"use client"

import * as React from "react"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// ── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_COOKIE_KEY = "havenflow-sidebar-open"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

// ── Context ───────────────────────────────────────────────────────────────────

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const ctx = React.useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>")
  return ctx
}

// ── Provider ─────────────────────────────────────────────────────────────────

interface SidebarProviderProps {
  children: React.ReactNode
  defaultOpen?: boolean
}

/**
 * Provides sidebar open/closed state to all children.
 * Persists state in localStorage and supports a keyboard shortcut (Ctrl/⌘ + B).
 */
export function SidebarProvider({ children, defaultOpen = true }: SidebarProviderProps) {
  const [open, setOpenState] = React.useState(defaultOpen)
  const [isMobile, setIsMobile] = React.useState(false)

  // Read persisted state after mount (avoids SSR mismatch)
  React.useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COOKIE_KEY)
    if (stored !== null) setOpenState(stored === "true")
  }, [])

  // Detect mobile breakpoint
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const setOpen = React.useCallback((value: boolean) => {
    setOpenState(value)
    localStorage.setItem(SIDEBAR_COOKIE_KEY, String(value))
  }, [])

  const toggle = React.useCallback(() => setOpen(!open), [open, setOpen])

  // Keyboard shortcut: Ctrl/⌘ + B
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === SIDEBAR_KEYBOARD_SHORTCUT) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [toggle])

  return (
    <SidebarContext.Provider value={{ open, setOpen, toggle, isMobile }}>
      <TooltipProvider delayDuration={0}>{children}</TooltipProvider>
    </SidebarContext.Provider>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

/**
 * The sidebar container. Hidden on mobile (≤ md), visible on desktop.
 * Collapses to icon-only mode when `open` is false.
 */
export function Sidebar({ className, children, ...props }: React.ComponentProps<"aside">) {
  const { open } = useSidebar()
  return (
    <aside
      data-open={open}
      className={cn(
        // Hidden on mobile — bottom nav handles mobile
        "group hidden md:flex",
        "relative h-svh flex-col border-e border-sidebar-border bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-300 ease-in-out",
        open ? "w-64" : "w-14",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

// ── Trigger ───────────────────────────────────────────────────────────────────

/**
 * Button that toggles the sidebar open/collapsed.
 * Shows a keyboard hint tooltip.
 */
export function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { toggle } = useSidebar()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Toggle sidebar"
          onClick={toggle}
          className={cn("shrink-0", className)}
          {...props}
        >
          <PanelLeft className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        Toggle sidebar
        <kbd className="ml-1.5 rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] font-mono">
          ⌘B
        </kbd>
      </TooltipContent>
    </Tooltip>
  )
}

// ── Header ────────────────────────────────────────────────────────────────────

export function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex shrink-0 flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

export function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2", className)}
      {...props}
    />
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────

export function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex shrink-0 flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

// ── Separator ─────────────────────────────────────────────────────────────────

export function SidebarSeparator({ className, ...props }: React.ComponentProps<"hr">) {
  return (
    <hr
      className={cn("mx-2 border-sidebar-border", className)}
      {...props}
    />
  )
}

// ── Group ─────────────────────────────────────────────────────────────────────

export function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  )
}

/**
 * Label shown above a sidebar group. Fades out when sidebar is collapsed.
 */
export function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"p">) {
  const { open } = useSidebar()
  return (
    <p
      className={cn(
        "px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50",
        "overflow-hidden whitespace-nowrap transition-[opacity,max-height] duration-300",
        open ? "max-h-8 opacity-100" : "max-h-0 opacity-0",
        className
      )}
      {...props}
    />
  )
}

// ── Menu ──────────────────────────────────────────────────────────────────────

export function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("flex flex-col gap-0.5", className)} {...props} />
}

export function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li className={cn("list-none", className)} {...props} />
}

// ── Menu Button ───────────────────────────────────────────────────────────────

interface SidebarMenuButtonProps {
  isActive?: boolean
  /** Icon node — always visible */
  icon?: React.ReactNode
  /** Label text — hidden (but accessible) when sidebar is collapsed */
  label: string
  /** Tooltip shown on hover when sidebar is collapsed. Defaults to label. */
  tooltip?: string
  /** Navigate to this path (renders an anchor). Omit to render a button. */
  href?: string
  onClick?: () => void
  className?: string
}

/**
 * A sidebar navigation item.
 * - Pass `href` to render as a link, or `onClick` to render as a button.
 * - Shows icon + label when expanded.
 * - Shows icon only with tooltip when collapsed.
 */
export function SidebarMenuButton({
  isActive,
  icon,
  label,
  tooltip,
  href,
  onClick,
  className,
}: SidebarMenuButtonProps) {
  const { open } = useSidebar()

  const sharedClass = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium outline-none",
    "transition-colors duration-150",
    "focus-visible:ring-2 focus-visible:ring-sidebar-ring",
    isActive
      ? "bg-sidebar-primary text-sidebar-primary-foreground"
      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
    !open && "justify-center px-0",
    className
  )

  const content = (
    <>
      {icon && (
        <span className="flex size-5 shrink-0 items-center justify-center">{icon}</span>
      )}
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300",
          open ? "max-w-48 opacity-100" : "max-w-0 opacity-0"
        )}
      >
        {label}
      </span>
    </>
  )

  // Link variant (Next.js Link is imported in the consumer — use native <a> here
  // so we avoid pulling in next/link into the primitive)
  const inner = href ? (
    <a
      href={href}
      className={sharedClass}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </a>
  ) : (
    <button
      type="button"
      onClick={onClick}
      className={sharedClass}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </button>
  )

  // Show tooltip when sidebar is collapsed
  if (!open) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right">{tooltip ?? label}</TooltipContent>
      </Tooltip>
    )
  }

  return inner
}

// ── Inset ─────────────────────────────────────────────────────────────────────

/**
 * The main content area that sits alongside the sidebar in the flex row.
 * Fills remaining space and scrolls independently.
 */
export function SidebarInset({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col", className)}
      {...props}
    />
  )
}

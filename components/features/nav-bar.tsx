"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  PiggyBank,
  BarChart2,
  ReceiptText,
} from "lucide-react"

import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/shopping-list", label: "Shopping", icon: ShoppingCart },
  { href: "/reports", label: "Reports", icon: BarChart2 },
]

/**
 * Desktop horizontal nav (visible md+).
 * Highlights the active route using usePathname.
 */
export function NavDesktop() {
  const pathname = usePathname()
  return (
    <nav className="hidden gap-1 md:flex" aria-label="Main navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-primary/10 font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}

/**
 * Mobile sticky bottom navigation (hidden md+).
 * Place as a direct sibling of <main> so sticky bottom-0 works correctly.
 */
export function NavMobile() {
  const pathname = usePathname()
  return (
    <nav
      className="sticky bottom-0 z-40 flex border-t border-border bg-background/90 backdrop-blur md:hidden"
      aria-label="Mobile navigation"
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

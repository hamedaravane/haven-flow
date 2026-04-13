import type { Metadata } from "next"
import Link from "next/link"
import { LayoutDashboard, Home, ShoppingCart, Package, PiggyBank, BarChart2 } from "lucide-react"

import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "HavenFlow",
  description: "Your household finance and pantry companion",
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: PiggyBank },
  { href: "/budgets", label: "Budgets", icon: BarChart2 },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/shopping-list", label: "Shopping", icon: ShoppingCart },
  { href: "/reports", label: "Reports", icon: Home },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Top navigation bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-lg items-center justify-between px-4">
          <Link href="/dashboard" className="font-medium text-foreground">
            🏡 HavenFlow
          </Link>
          {/* Desktop nav */}
          <nav className="hidden gap-1 md:flex">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-screen-lg flex-1 px-4 py-6">{children}</main>

      {/* Mobile bottom navigation */}
      <nav className="sticky bottom-0 z-40 flex border-t border-border bg-background/80 backdrop-blur md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            )}
          >
            <Icon className="size-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}

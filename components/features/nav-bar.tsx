"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ReceiptText,
  Package,
  BarChart2,
  MoreHorizontal,
  PiggyBank,
  ShoppingCart,
  Wallet,
  FileUp,
  Tags,
  Settings,
  LogOut,
} from "lucide-react"

import { signOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

// ── Bottom nav items (max 5) ─────────────────────────────────────────────────

const BOTTOM_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/transactions", label: "Money", icon: ReceiptText },
  { href: "/inventory", label: "Pantry", icon: Package },
  { href: "/reports", label: "Reports", icon: BarChart2 },
] as const

// ── "More" menu items ─────────────────────────────────────────────────────────

const MORE_ITEMS = [
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/shopping-list", label: "Shopping List", icon: ShoppingCart },
  { href: "/wallets", label: "Wallets", icon: Wallet },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/import", label: "Import CSV", icon: FileUp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const

// ── Mobile bottom navigation bar ─────────────────────────────────────────────

/**
 * Mobile sticky bottom navigation — shown on screens < md.
 * Contains the 5 most-used tabs. The last tab opens a "More" sheet
 * with the remaining pages.
 */
export function NavMobile() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = React.useState(false)

  // Close the "More" sheet after navigating
  const handleMoreItemClick = (href: string) => {
    setMoreOpen(false)
    router.push(href)
  }

  const handleLogout = async () => {
    setMoreOpen(false)
    await signOut()
    router.push("/login")
    router.refresh()
  }

  // Determine if any "More" item is the active route
  const moreIsActive = MORE_ITEMS.some(
    ({ href }) => pathname === href || pathname.startsWith(href + "/")
  )

  return (
    <nav
      className="sticky bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur md:hidden"
      aria-label="Mobile navigation"
    >
      {/* Primary bottom nav items */}
      {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span>{label}</span>
            {isActive && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </Link>
        )
      })}

      {/* "More" tab — opens a bottom sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="More navigation options"
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              moreIsActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden />
            <span>More</span>
            {moreIsActive && (
              <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
            )}
          </button>
        </SheetTrigger>

        <SheetContent side="bottom" className="max-h-[80svh] rounded-t-2xl px-4 pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-left text-base">More</SheetTitle>
          </SheetHeader>

          {/* More nav items grid */}
          <div className="grid grid-cols-3 gap-2">
            {MORE_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/")
              return (
                <button
                  key={href}
                  onClick={() => handleMoreItemClick(href)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </button>
              )
            })}
          </div>

          {/* Logout button */}
          <div className="mt-4 border-t border-border pt-4">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" aria-hidden />
              Log out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}

/**
 * @deprecated Desktop nav is now handled by AppSidebar.
 * Kept for backward-compatibility — renders nothing.
 */
export function NavDesktop() {
  return null
}


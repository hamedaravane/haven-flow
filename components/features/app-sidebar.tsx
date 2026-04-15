"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  ReceiptText,
  PiggyBank,
  Wallet,
  Package,
  ShoppingCart,
  BarChart2,
  Tags,
  FileUp,
  Settings,
  LogOut,
  Home,
} from "lucide-react"

import { signOut } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

// ── Navigation groups ────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/transactions", label: "Transactions", icon: ReceiptText },
      { href: "/budgets", label: "Budgets", icon: PiggyBank },
      { href: "/wallets", label: "Wallets", icon: Wallet },
      { href: "/import", label: "Import CSV", icon: FileUp },
    ],
  },
  {
    label: "Household",
    items: [
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/shopping-list", label: "Shopping List", icon: ShoppingCart },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart2 },
      { href: "/categories", label: "Categories", icon: Tags },
    ],
  },
]

// ── User info type ────────────────────────────────────────────────────────────

interface AppSidebarUser {
  id: string
  name: string
  email: string
}

interface AppSidebarProps {
  user: AppSidebarUser | null
}

// ── Logo / header ─────────────────────────────────────────────────────────────

function SidebarLogo() {
  const { open } = useSidebar()
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex h-10 items-center gap-2.5 rounded-lg px-2 font-semibold text-sidebar-foreground",
        "transition-colors hover:bg-sidebar-accent",
        !open && "justify-center px-0"
      )}
      aria-label="HavenFlow home"
    >
      <Home className="size-5 shrink-0 text-sidebar-primary" />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-300",
          open ? "max-w-48 opacity-100" : "max-w-0 opacity-0"
        )}
      >
        HavenFlow
      </span>
    </Link>
  )
}

// ── User footer section ───────────────────────────────────────────────────────

function SidebarUser({ user }: { user: AppSidebarUser | null }) {
  const { open } = useSidebar()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push("/login")
    router.refresh()
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? "")
        .join("")
    : "?"

  const avatar = (
    <span
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        "bg-sidebar-primary text-sidebar-primary-foreground"
      )}
      aria-hidden
    >
      {initials}
    </span>
  )

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              className="flex w-full justify-center rounded-lg p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="Settings"
            >
              {avatar}
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">{user?.name ?? "User"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleLogout}
              className="flex w-full items-center justify-center rounded-lg p-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
              aria-label="Log out"
            >
              <LogOut className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Log out</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {/* User info + settings link */}
      <Link
        href="/settings"
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
        aria-label="Open settings"
      >
        {avatar}
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate font-medium leading-tight">{user?.name ?? "User"}</p>
          <p className="truncate text-[11px] text-sidebar-foreground/60">{user?.email ?? ""}</p>
        </div>
        <Settings className="size-4 shrink-0 text-sidebar-foreground/50" />
      </Link>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent"
      >
        <span className="flex size-5 shrink-0 items-center justify-center">
          <LogOut className="size-4" />
        </span>
        <span>Log out</span>
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * The application sidebar, shown on desktop (≥ md).
 * Contains: logo/trigger header, grouped nav items, user footer with logout.
 */
export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar>
      {/* Header: logo + collapse trigger */}
      <SidebarHeader>
        <div className="flex items-center justify-between gap-1">
          <SidebarLogo />
          <SidebarTrigger />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Navigation groups */}
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/")
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      href={href}
                      isActive={isActive}
                      icon={<Icon className="size-4" />}
                      label={label}
                    />
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer: user info + logout */}
      <SidebarFooter>
        <SidebarUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}


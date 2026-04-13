import type { Metadata } from "next"
import Link from "next/link"

import { NavDesktop, NavMobile } from "@/components/features/nav-bar"
import { ThemeToggle } from "@/components/features/theme-toggle"
import { PwaInit } from "@/components/features/pwa-init"

export const metadata: Metadata = {
  title: "HavenFlow",
  description: "Your household finance and pantry companion",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-screen-lg items-center gap-3 px-4">
          <Link href="/dashboard" className="font-medium text-foreground">
            🏡 HavenFlow
          </Link>
          {/* Desktop nav — fills remaining space */}
          <div className="flex flex-1 justify-center">
            <NavDesktop />
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <PwaInit />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto w-full max-w-screen-lg flex-1 px-4 py-6">{children}</main>

      {/* Mobile bottom nav — sticky to viewport bottom */}
      <NavMobile />
    </div>
  )
}


import type { Metadata } from "next"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { AppSidebar } from "@/components/features/app-sidebar"
import { NavMobile } from "@/components/features/nav-bar"
import { ThemeToggle } from "@/components/features/theme-toggle"
import { PwaInit } from "@/components/features/pwa-init"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export const metadata: Metadata = {
  title: "HavenFlow",
  description: "Your household finance and pantry companion",
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Fetch session server-side to pass user info into the sidebar footer
  const session = await auth.api.getSession({ headers: await headers() })
  const user = session?.user
    ? { id: session.user.id, name: session.user.name, email: session.user.email }
    : null

  return (
    <SidebarProvider>
      <div className="flex h-svh w-full">
        {/* Desktop sidebar — hidden on mobile, handles nav for md+ */}
        <AppSidebar user={user} />

        {/* Main content area */}
        <SidebarInset>
          {/* Mobile-only top header */}
          <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:hidden">
            <span className="font-semibold text-foreground">🏡 HavenFlow</span>
            <div className="flex flex-1 justify-end gap-1">
              <PwaInit />
              <ThemeToggle />
            </div>
          </header>

          {/* Desktop-only top bar (thin, just for actions) */}
          <header className="sticky top-0 z-40 hidden h-12 shrink-0 items-center justify-end gap-1 border-b border-border bg-background/80 px-4 backdrop-blur md:flex">
            <PwaInit />
            <ThemeToggle />
          </header>

          {/* Page content */}
          <div className="max-h-svh overflow-y-scroll">
            <main className="w-full max-w-4xl px-4 py-6 mx-auto">{children}</main>
          </div>

          {/* Mobile bottom navigation */}
          <NavMobile />
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}


import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/features/toaster"
import { cn } from "@/lib/utils"

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EFF6FF" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

export const metadata: Metadata = {
  title: {
    default: "HavenFlow",
    template: "%s — HavenFlow",
  },
  description: "Your household finance and pantry companion",
  manifest: "/manifest.json",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", GeistSans.variable, GeistMono.variable, "font-sans")}
    >
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

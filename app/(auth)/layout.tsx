import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign in — HavenFlow",
  description: "Sign in to your HavenFlow household",
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-1">
        <span className="text-3xl" aria-hidden>🏡</span>
        <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
          HavenFlow
        </span>
        <span className="text-xs text-muted-foreground">Your home, organised</span>
      </div>
      {children}
    </div>
  )
}


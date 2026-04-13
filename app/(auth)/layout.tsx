import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign in — HavenFlow",
  description: "Sign in to your HavenFlow household",
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-12">
      {children}
    </div>
  )
}

import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

/**
 * Root landing page.
 * Redirects authenticated users to the dashboard and unauthenticated users to login.
 * The middleware handles most cases; this is an extra safeguard for direct `/` visits.
 */
export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (session) {
    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}

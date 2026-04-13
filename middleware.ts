import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

/**
 * Paths that are publicly accessible (no authentication required).
 */
const PUBLIC_PATHS = ["/login", "/register", "/api/auth"]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons")
  ) {
    return NextResponse.next()
  }

  // Check for a valid Better Auth session
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    // Redirect unauthenticated users to login
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users away from the root to the dashboard
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Run middleware on all paths except Next.js internals and static files
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|ttf)).*)"],
}

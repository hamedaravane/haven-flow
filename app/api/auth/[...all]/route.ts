import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

/**
 * Catch-all API route that delegates all /api/auth/* requests to Better Auth.
 * This handles sign-in, sign-up, sign-out, session refresh, etc.
 */
export const { GET, POST } = toNextJsHandler(auth)

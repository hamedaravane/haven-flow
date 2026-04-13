import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@/lib/db"
import { user, session, account, verification } from "@/lib/db/schema"

/**
 * Better Auth server-side configuration.
 * Uses Drizzle + PostgreSQL to store users and sessions.
 * Only email/password authentication is enabled in Phase 1.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user,
      session,
      account,
      verification,
    },
  }),

  /**
   * baseURL is read from BETTER_AUTH_URL first, then falls back to NEXT_PUBLIC_APP_URL.
   * Set either env var to the full origin (e.g. https://havenflow.example.com).
   */
  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000",

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes client-side cache
    },
  },

  trustedOrigins: [process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"],
})

export type Session = typeof auth.$Infer.Session

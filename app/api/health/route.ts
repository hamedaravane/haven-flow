import { NextResponse } from "next/server"

/**
 * GET /api/health
 * Simple health check endpoint used by Docker healthcheck and monitoring.
 * Returns 200 when the Next.js server is up and responding.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" })
}

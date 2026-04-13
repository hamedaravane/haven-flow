import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { pushSubscriptions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { vapidPublicKey } from "@/lib/push"

/** GET /api/push/subscribe — return the VAPID public key for browser subscription */
export async function GET() {
  if (!vapidPublicKey) {
    return NextResponse.json({ error: "Push notifications not configured" }, { status: 503 })
  }
  return NextResponse.json({ vapidPublicKey })
}

/** POST /api/push/subscribe — save or update a push subscription */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { endpoint, keys } = body as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 })
  }

  const household = await getOrCreateHousehold(session.user.id)

  // Upsert: update if endpoint already exists, insert otherwise
  const existing = await db.query.pushSubscriptions.findFirst({
    where: eq(pushSubscriptions.endpoint, endpoint),
  })

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh: keys.p256dh, auth: keys.auth })
      .where(eq(pushSubscriptions.endpoint, endpoint))
  } else {
    await db.insert(pushSubscriptions).values({
      userId: session.user.id,
      householdId: household.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    })
  }

  return NextResponse.json({ success: true })
}

/** DELETE /api/push/subscribe — remove a push subscription */
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { endpoint } = body as { endpoint: string }

  if (!endpoint) {
    return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })
  }

  await db
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, endpoint),
        eq(pushSubscriptions.userId, session.user.id)
      )
    )

  return NextResponse.json({ success: true })
}

"use server"

import { headers } from "next/headers"
import { and, eq, gte, lt, lte, sql } from "drizzle-orm"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { budgets, households, inventory, pushSubscriptions, transactions } from "@/lib/db/schema"
import { getOrCreateHousehold } from "@/lib/db/queries"
import { sendPushNotification } from "@/lib/push"
import { currentMonth, monthBounds } from "@/lib/constants"

/** Minimum hours between notification batches for the same household */
const COOLDOWN_HOURS = 6

/**
 * Check expiring inventory items and over-budget categories for the current
 * user's household, then send push notifications to all subscribed devices.
 *
 * Safe to call on every dashboard load — respects a 6-hour cooldown per household.
 */
export async function checkAndSendNotifications() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return

  const household = await getOrCreateHousehold(session.user.id)

  // ── Cooldown check ─────────────────────────────────────────────────────────
  if (household.notificationsSentAt) {
    const hoursSince =
      (Date.now() - household.notificationsSentAt.getTime()) / (1000 * 60 * 60)
    if (hoursSince < COOLDOWN_HOURS) return
  }

  // ── Get all push subscriptions for this household ──────────────────────────
  const subs = await db.query.pushSubscriptions.findMany({
    where: eq(pushSubscriptions.householdId, household.id),
  })
  if (subs.length === 0) return

  const messages: Array<{ title: string; body: string; url: string }> = []

  // ── Check expiring inventory items (within 2 days) ─────────────────────────
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
  const expiringItems = await db.query.inventory.findMany({
    where: and(
      eq(inventory.householdId, household.id),
      lte(inventory.expiresAt, twoDaysFromNow)
    ),
  })

  if (expiringItems.length > 0) {
    const names = expiringItems
      .slice(0, 3)
      .map((i) => i.name)
      .join(", ")
    const extra = expiringItems.length > 3 ? ` and ${expiringItems.length - 3} more` : ""
    messages.push({
      title: "🧊 Items expiring soon!",
      body: `${names}${extra} will expire within 2 days.`,
      url: "/inventory",
    })
  }

  // ── Check budget overspend (≥80%) ──────────────────────────────────────────
  const month = currentMonth()
  const { start, end } = monthBounds(month)

  const currentBudgets = await db.query.budgets.findMany({
    where: and(eq(budgets.householdId, household.id), eq(budgets.month, month)),
  })

  if (currentBudgets.length > 0) {
    const spentRows = await db
      .select({
        category: transactions.category,
        total: sql<string>`COALESCE(SUM(${transactions.amount}), '0')`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.householdId, household.id),
          eq(transactions.type, "expense"),
          gte(transactions.transactionDate, start),
          lt(transactions.transactionDate, end)
        )
      )
      .groupBy(transactions.category)

    const spentMap = Object.fromEntries(spentRows.map((r) => [r.category, parseFloat(r.total)]))

    const overBudget = currentBudgets.filter((b) => {
      const planned = parseFloat(b.plannedAmount)
      const spent = spentMap[b.category] ?? 0
      return planned > 0 && spent / planned >= 0.8
    })

    if (overBudget.length > 0) {
      const cats = overBudget
        .slice(0, 3)
        .map((b) => b.category)
        .join(", ")
      const extra = overBudget.length > 3 ? ` and ${overBudget.length - 3} more` : ""
      messages.push({
        title: "💸 Budget alert!",
        body: `${cats}${extra} budget${overBudget.length > 1 ? "s are" : " is"} 80%+ spent.`,
        url: "/budgets",
      })
    }
  }

  if (messages.length === 0) return

  // ── Send to all subscribed devices ─────────────────────────────────────────
  for (const sub of subs) {
    for (const msg of messages) {
      await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        msg
      )
    }
  }

  // ── Update cooldown timestamp ───────────────────────────────────────────────
  await db
    .update(households)
    .set({ notificationsSentAt: new Date() })
    .where(eq(households.id, household.id))
}
